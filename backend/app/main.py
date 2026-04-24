from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas, auth, database
from .database import engine, get_db
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import redis.asyncio as redis
import json
import asyncio
import uuid
import time
from typing import List, Dict

# Initialize database
try:
    models.Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Database initialization info: {e}")

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.redis_host = "redis"
        self.redis = None

    async def get_redis(self):
        if self.redis is None:
            self.redis = await redis.from_url(f"redis://{self.redis_host}", decode_responses=True)
        return self.redis

    async def connect(self, client_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        
        # Subscribe to Redis channel for this user and global updates
        redis_conn = await self.get_redis()
        pubsub = redis_conn.pubsub()
        await pubsub.subscribe(f"user_{client_id}", "global_users_update")
        
        # Update presence in Redis with TTL (60 seconds)
        await redis_conn.setex(f"presence:{client_id}", 60, "online")
        await redis_conn.sadd("online_users", client_id)
        
        # Start a background task to listen for Redis messages
        asyncio.create_task(self._redis_listener(client_id, pubsub))
        
        await self.broadcast_user_list()

    async def _redis_listener(self, client_id: int, pubsub):
        try:
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    if message['channel'] == "global_users_update":
                        # Global update received, refresh local client's user list
                        redis_conn = await self.get_redis()
                        online_users = await redis_conn.smembers("online_users")
                        user_list = [int(uid) for uid in online_users]
                        update_msg = {"type": "users_update", "users": user_list}
                        if client_id in self.active_connections:
                            await self.active_connections[client_id].send_text(json.dumps(update_msg))
                    else:
                        # Personal message
                        data = json.loads(message['data'])
                        if client_id in self.active_connections:
                            await self.active_connections[client_id].send_text(json.dumps(data))
        except Exception as e:
            print(f"Redis listener error for {client_id}: {e}")
        finally:
            await pubsub.unsubscribe(f"user_{client_id}", "global_users_update")

    async def disconnect(self, client_id: int):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            
            # Remove from global online users set and delete presence key
            redis_conn = await self.get_redis()
            await redis_conn.delete(f"presence:{client_id}")
            await redis_conn.srem("online_users", client_id)
            
            await self.broadcast_user_list()

    async def update_presence(self, client_id: int):
        redis_conn = await self.get_redis()
        await redis_conn.setex(f"presence:{client_id}", 60, "online")
        # Ensure they are in the online set
        await redis_conn.sadd("online_users", client_id)

    async def save_message(self, sender_id: int, receiver_id: int, message: str):
        redis_conn = await self.get_redis()
        msg_id = str(uuid.uuid4())
        timestamp = int(time.time() * 1000)
        
        message_data = {
            "id": msg_id,
            "from": sender_id,
            "to": receiver_id,
            "message": message,
            "timestamp": timestamp,
            "type": "message"
        }
        
        # Consistent key for both users: chat:min_id:max_id
        chat_key = f"chat:{min(sender_id, receiver_id)}:{max(sender_id, receiver_id)}"
        
        # Store in Redis list (NoSQL approach)
        await redis_conn.rpush(chat_key, json.dumps(message_data))
        await redis_conn.ltrim(chat_key, -100, -1)
        
        return message_data

    async def save_group_message(self, sender_id: int, group_id: int, message: str):
        redis_conn = await self.get_redis()
        msg_id = str(uuid.uuid4())
        timestamp = int(time.time() * 1000)
        
        message_data = {
            "id": msg_id,
            "from": sender_id,
            "group_id": group_id,
            "message": message,
            "timestamp": timestamp,
            "type": "group_message"
        }
        
        chat_key = f"group_chat:{group_id}"
        await redis_conn.rpush(chat_key, json.dumps(message_data))
        await redis_conn.ltrim(chat_key, -100, -1)
        
        return message_data

    async def get_history(self, user_a: int, user_b: int):
        redis_conn = await self.get_redis()
        chat_key = f"chat:{min(user_a, user_b)}:{max(user_a, user_b)}"
        messages = await redis_conn.lrange(chat_key, 0, -1)
        return [json.loads(m) for m in messages]

    async def get_group_history(self, group_id: int):
        redis_conn = await self.get_redis()
        chat_key = f"group_chat:{group_id}"
        messages = await redis_conn.lrange(chat_key, 0, -1)
        return [json.loads(m) for m in messages]

    async def send_personal_message(self, message: dict, client_id: int):
        redis_conn = await self.get_redis()
        await redis_conn.publish(f"user_{client_id}", json.dumps(message))

    async def broadcast_to_group(self, message: dict, group_id: int, db: Session):
        # Fan-out to all group members
        members = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).all()
        redis_conn = await self.get_redis()
        for member in members:
            # We publish to each user's channel. In a larger system, we might use a different fan-out strategy.
            await redis_conn.publish(f"user_{member.user_id}", json.dumps(message))

    async def send_read_receipt(self, sender_id: int, receiver_id: int, message_id: str):
        redis_conn = await self.get_redis()
        receipt = {
            "type": "read_receipt",
            "message_id": message_id,
            "from": sender_id,
            "timestamp": int(time.time() * 1000)
        }
        await redis_conn.publish(f"user_{receiver_id}", json.dumps(receipt))

    async def broadcast_user_list(self):
        # Notify all instances that the user list has changed
        redis_conn = await self.get_redis()
        await redis_conn.publish("global_users_update", "update")


manager = ConnectionManager()

@app.get("/")
async def get():
    return {"status": "Chat server is running"}

@app.post("/register", response_model=schemas.UserRead)
@limiter.limit("5/minute")
async def register(request: Request, user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.phone == user.phone).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Phone already registered")
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(phone=user.phone, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login", response_model=schemas.Token)
@limiter.limit("5/minute")
async def login(request: Request, user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.phone == user.phone).first()
    if not db_user or not auth.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect phone or password")
    
    access_token = auth.create_access_token(data={"sub": db_user.phone})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me", response_model=schemas.UserRead)
async def read_users_me(phone: str = Depends(auth.get_current_user_phone), db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.phone == phone).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@app.get("/users", response_model=List[schemas.UserRead])
async def read_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return users

@app.get("/history/{other_user_id}")
async def get_chat_history(
    other_user_id: int, 
    current_user_phone: str = Depends(auth.get_current_user_phone),
    db: Session = Depends(get_db)
):
    current_user = db.query(models.User).filter(models.User.phone == current_user_phone).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    history = await manager.get_history(current_user.id, other_user_id)
    return history

@app.post("/groups", response_model=schemas.GroupRead)
async def create_group(
    group: schemas.GroupCreate,
    current_user_phone: str = Depends(auth.get_current_user_phone),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.phone == current_user_phone).first()
    new_group = models.Group(name=group.name, created_by=user.id)
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    
    # Add creator as first member
    member = models.GroupMember(group_id=new_group.id, user_id=user.id)
    db.add(member)
    db.commit()
    
    return new_group

@app.post("/groups/{group_id}/members")
async def add_group_member(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    member = models.GroupMember(group_id=group_id, user_id=user_id)
    db.add(member)
    db.commit()
    return {"status": "success"}

@app.get("/groups/{group_id}/history")
async def get_group_chat_history(group_id: int):
    history = await manager.get_group_history(group_id)
    return history

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: int, db: Session = Depends(get_db)):
    await manager.connect(client_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                msg_type = payload.get("type")
                
                if msg_type == "ping":
                    await manager.update_presence(client_id)
                    continue
                
                if msg_type == "read_receipt":
                    target_id = payload.get("to")
                    msg_id = payload.get("message_id")
                    if target_id and msg_id:
                        await manager.send_read_receipt(client_id, int(target_id), msg_id)
                    continue

                if msg_type == "group_message":
                    group_id = payload.get("group_id")
                    message_text = payload.get("message")
                    if group_id and message_text:
                        saved_msg = await manager.save_group_message(client_id, int(group_id), message_text)
                        await manager.broadcast_to_group(saved_msg, int(group_id), db)
                    continue

                target_id = payload.get("to")
                message_text = payload.get("message")
                
                if target_id is not None and message_text:
                    # Save message to Redis (NoSQL store)
                    saved_msg = await manager.save_message(client_id, int(target_id), message_text)
                    
                    # Send to target via Redis pub/sub
                    await manager.send_personal_message(saved_msg, int(target_id))
                    
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        await manager.disconnect(client_id)

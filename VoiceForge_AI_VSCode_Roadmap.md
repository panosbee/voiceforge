# VoiceForge AI — Complete VS Code Development Roadmap
**Version 1.0 | February 2026 | INTERNAL — DO NOT DISTRIBUTE**

> Αυτό είναι ο οδηγός που ακολουθούμε μαζί στο VS Code.
> Κάθε βήμα έχει ακριβείς εντολές, ακριβή αρχεία, ακριβή κώδικα.
> Δεν υπάρχει θεωρία — μόνο execution.

---

## PHASE 0 — PREREQUISITES (Before opening VS Code)

### 0.1 Accounts που πρέπει να υπάρχουν ΠΡΙΝ ξεκινήσουμε

| Service | URL | Action |
|---|---|---|
| Telnyx | telnyx.com | Sign up + Level 2 verification + request Managed Accounts |
| Supabase | supabase.com | Create project → select **eu-central-1 (Frankfurt)** |
| Stripe | stripe.com | Sign up → get test keys |
| Google Cloud | console.cloud.google.com | Create project → enable Calendar API → create OAuth credentials |
| Resend | resend.com | Sign up → get API key |
| Railway | railway.app | Sign up (for deployment later) |

### 0.2 Local tools
```bash
# Ελέγχουμε ότι υπάρχουν
python --version        # 3.12+
node --version          # 18+
npm --version
git --version

# Εγκαθιστούμε αν λείπουν
pip install uv          # Fast Python package manager
npm install -g pnpm     # Fast Node package manager

# ngrok για webhooks σε development
# Κατεβάζουμε από ngrok.com και βάζουμε στο PATH
ngrok --version
```

---

## PHASE 1 — PROJECT SCAFFOLD (Day 1)

### 1.1 Δημιουργία project structure

```bash
mkdir voiceforge-ai
cd voiceforge-ai
git init

# Δημιουργία φακέλων
mkdir -p backend/routers
mkdir -p backend/services
mkdir -p backend/models
mkdir -p frontend/src/pages/Onboarding
mkdir -p frontend/src/pages
mkdir -p frontend/src/components/ui
mkdir -p frontend/src/services
mkdir -p frontend/public

touch .gitignore
touch README.md
touch docker-compose.yml
```

### 1.2 .gitignore
```
# Python
__pycache__/
*.pyc
.env
.venv/
dist/

# Node
node_modules/
.env.local
.env.production

# IDE
.vscode/settings.json
.idea/

# Telnyx / sensitive
*.key
```

### 1.3 Backend — Python environment
```bash
cd backend

# Δημιουργία virtual environment με uv
uv venv .venv
source .venv/bin/activate   # Mac/Linux
# .venv\Scripts\activate    # Windows

# Δημιουργία requirements.txt
cat > requirements.txt << 'EOF'
fastapi==0.115.0
uvicorn[standard]==0.30.0
python-dotenv==1.0.0
telnyx==2.0.0
sqlalchemy==2.0.30
asyncpg==0.29.0
supabase==2.4.0
stripe==9.0.0
google-auth==2.29.0
google-auth-oauthlib==1.2.0
google-api-python-client==2.125.0
pywebpush==2.0.0
resend==2.0.0
httpx==0.27.0
pydantic==2.7.0
pydantic-settings==2.2.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
EOF

uv pip install -r requirements.txt
```

### 1.4 .env.example (backend)
```bash
cat > .env.example << 'EOF'
# ─── TELNYX ────────────────────────────────────────────────────
TELNYX_API_KEY=KEYxxxxxxxxxxxxxxxxxxxxxxxx
TELNYX_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxxxxxxx

# ─── SUPABASE ──────────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://postgres:pass@db.xxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxx

# ─── GOOGLE CALENDAR ───────────────────────────────────────────
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxx
GOOGLE_REDIRECT_URI=https://api.voiceforge.ai/calendar/callback

# ─── STRIPE ────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxx
STRIPE_STARTER_PRICE_ID=price_xxxxxxxxxx
STRIPE_PRO_PRICE_ID=price_xxxxxxxxxx
STRIPE_BUSINESS_PRICE_ID=price_xxxxxxxxxx

# ─── WEB PUSH ──────────────────────────────────────────────────
VAPID_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_EMAIL=admin@voiceforge.ai

# ─── APP ───────────────────────────────────────────────────────
SECRET_KEY=change-this-to-random-32-chars
FRONTEND_URL=http://localhost:5173
API_BASE_URL=http://localhost:8000
ENVIRONMENT=development
EOF

cp .env.example .env
# ΣΗΜΑΝΤΙΚΟ: Συμπλήρωσε τα values στο .env — ΜΗΝ κάνεις commit το .env
```

---

## PHASE 2 — BACKEND CORE FILES (Week 1)

### 2.1 config.py
```python
# backend/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Telnyx
    telnyx_api_key: str
    telnyx_public_key: str
    
    # Database
    database_url: str
    supabase_url: str
    supabase_service_role_key: str
    
    # Google
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str
    
    # Stripe
    stripe_secret_key: str
    stripe_webhook_secret: str
    stripe_starter_price_id: str
    stripe_pro_price_id: str
    stripe_business_price_id: str
    
    # Push
    vapid_public_key: str
    vapid_private_key: str
    vapid_email: str
    
    # App
    secret_key: str
    frontend_url: str
    api_base_url: str
    environment: str = "development"
    
    class Config:
        env_file = ".env"

settings = Settings()
```

### 2.2 database.py
```python
# backend/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    pool_size=10,
    max_overflow=20
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### 2.3 models/customer.py
```python
# backend/models/customer.py
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from database import Base

class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, unique=True, nullable=False)  # Supabase auth user ID
    email = Column(String, unique=True, nullable=False)
    business_name = Column(String, nullable=False)
    
    # Telnyx sub-account — αυτό είναι το κλειδί της multi-tenant αρχιτεκτονικής
    telnyx_account_id = Column(String, unique=True, nullable=True)
    telnyx_api_key = Column(String, nullable=True)  # Encrypted στο production
    
    # Stripe
    stripe_customer_id = Column(String, unique=True, nullable=True)
    stripe_subscription_id = Column(String, unique=True, nullable=True)
    plan = Column(String, default="starter")  # starter | pro | business | enterprise
    
    # Google Calendar
    google_oauth_token = Column(Text, nullable=True)  # JSON encrypted
    google_calendar_id = Column(String, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    onboarding_complete = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    agents = relationship("Agent", back_populates="customer")
    calls = relationship("Call", back_populates="customer")


class Agent(Base):
    __tablename__ = "agents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    
    # Telnyx
    telnyx_assistant_id = Column(String, unique=True, nullable=True)
    telnyx_phone_number = Column(String, unique=True, nullable=True)
    
    # Agent config
    name = Column(String, nullable=False)
    industry = Column(String, nullable=False)  # law | medical | realestate | beauty | custom
    instructions = Column(Text, nullable=False)
    greeting = Column(Text, nullable=False)
    voice = Column(String, default="el-GR-AthinaNeural")
    
    is_live = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    customer = relationship("Customer", back_populates="agents")
    calls = relationship("Call", back_populates="agent")


class Call(Base):
    __tablename__ = "calls"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    
    telnyx_conversation_id = Column(String, unique=True, nullable=True)
    caller_number = Column(String, nullable=True)
    duration_seconds = Column(String, nullable=True)
    transcript = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    appointment_booked = Column(Boolean, default=False)
    sentiment = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    customer = relationship("Customer", back_populates="calls")
    agent = relationship("Agent", back_populates="calls")
```

### 2.4 services/telnyx.py — Telnyx SDK Wrapper
```python
# backend/services/telnyx.py
import telnyx
import httpx
from config import settings

# Initialize Telnyx with master API key
telnyx.api_key = settings.telnyx_api_key


class TelnyxService:
    """
    Wrapper for all Telnyx API calls.
    Master account operations use settings.telnyx_api_key.
    Sub-account operations receive the customer's api_key as parameter.
    """
    
    # ─── MANAGED ACCOUNTS ─────────────────────────────────────────────
    
    async def create_sub_account(self, business_name: str) -> dict:
        """Creates a Telnyx sub-account for a new customer."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.telnyx.com/v2/managed_accounts",
                headers={
                    "Authorization": f"Bearer {settings.telnyx_api_key}",
                    "Content-Type": "application/json"
                },
                json={"business_name": business_name}
            )
            response.raise_for_status()
            data = response.json()["data"]
            return {
                "managed_account_id": data["id"],
                "api_key": data["api_key"]  # Store this — it controls the sub-account
            }
    
    # ─── PHONE NUMBERS ─────────────────────────────────────────────────
    
    async def list_available_greek_numbers(self, customer_api_key: str) -> list:
        """Lists available +30 Greek phone numbers."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.telnyx.com/v2/available_phone_numbers",
                headers={"Authorization": f"Bearer {customer_api_key}"},
                params={
                    "filter[country_code]": "GR",
                    "filter[features][]": "voice",
                    "page[size]": 20
                }
            )
            response.raise_for_status()
            return response.json()["data"]
    
    async def purchase_number(self, phone_number: str, customer_api_key: str) -> str:
        """Purchases a phone number for a sub-account."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.telnyx.com/v2/number_orders",
                headers={
                    "Authorization": f"Bearer {customer_api_key}",
                    "Content-Type": "application/json"
                },
                json={"phone_numbers": [{"phone_number": phone_number}]}
            )
            response.raise_for_status()
            return phone_number
    
    # ─── AI ASSISTANTS ─────────────────────────────────────────────────
    
    async def create_assistant(
        self,
        customer_api_key: str,
        name: str,
        instructions: str,
        greeting: str,
        voice: str = "el-GR-AthinaNeural",
        industry: str = "law"
    ) -> str:
        """Creates an AI assistant for a customer sub-account."""
        
        payload = {
            "name": name,
            "model": "openai/gpt-4o",
            "instructions": instructions,
            "greeting": greeting,
            
            "voice_settings": {
                "voice": voice
            },
            
            "transcription": {
                "model": "deepgram/nova-3",
                "language": "el",
                "settings": {
                    "smart_format": True,
                    "eot_timeout_ms": 700
                }
            },
            
            "enabled_features": ["telephony"],
            
            # Pre-call webhook — loads customer profile & dynamic variables
            "dynamic_variables_webhook_url": f"{settings.api_base_url}/telnyx/pre-call",
            
            "tools": [
                {
                    "type": "webhook",
                    "webhook": {
                        "name": "check_availability",
                        "description": "Ελέγχει διαθέσιμα ραντεβού στο ημερολόγιο",
                        "url": f"{settings.api_base_url}/tools/calendar/check",
                        "method": "POST",
                        "body_parameters": {
                            "properties": {
                                "requested_date": {"type": "string", "description": "Ημερομηνία YYYY-MM-DD"},
                                "service_type": {"type": "string", "description": "Τύπος ραντεβού"}
                            },
                            "required": ["requested_date"]
                        }
                    }
                },
                {
                    "type": "webhook",
                    "webhook": {
                        "name": "book_appointment",
                        "description": "Κλείνει ραντεβού στο ημερολόγιο",
                        "url": f"{settings.api_base_url}/tools/calendar/book",
                        "method": "POST",
                        "body_parameters": {
                            "properties": {
                                "date": {"type": "string"},
                                "time": {"type": "string"},
                                "caller_name": {"type": "string"},
                                "caller_phone": {"type": "string"},
                                "notes": {"type": "string"}
                            },
                            "required": ["date", "time", "caller_name"]
                        }
                    }
                },
                {"type": "hangup"}
            ],
            
            "telephony_settings": {
                "noise_suppression": "krisp",
                "time_limit_secs": 1800,
                "voicemail_detection": {
                    "on_voicemail_detected": {"action": "stop_assistant"}
                }
            },
            
            "insight_settings": {
                "insight_group_id": "default_voice_insights"
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.telnyx.com/v2/ai/assistants",
                headers={
                    "Authorization": f"Bearer {customer_api_key}",
                    "Content-Type": "application/json"
                },
                json=payload
            )
            response.raise_for_status()
            return response.json()["data"]["id"]
    
    async def assign_number_to_assistant(
        self,
        phone_number: str,
        assistant_id: str,
        customer_api_key: str
    ) -> None:
        """Assigns a purchased number to an AI assistant."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.telnyx.com/v2/phone_number_assignments",
                headers={
                    "Authorization": f"Bearer {customer_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "phone_number": phone_number,
                    "connection_id": assistant_id
                }
            )
            response.raise_for_status()


# Singleton instance
telnyx_service = TelnyxService()
```

### 2.5 routers/webhooks.py — The Heart of the Platform
```python
# backend/routers/webhooks.py
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.customer import Customer, Agent, Call
from services.calendar_service import CalendarService
from services.push_service import PushService
from fastapi import Depends
import json

router = APIRouter(prefix="/telnyx", tags=["telnyx-webhooks"])

# ─── PRE-CALL WEBHOOK ──────────────────────────────────────────────────────────
# Telnyx calls this at the START of every call.
# We return dynamic variables that get injected into the agent's system prompt.
# This is HOW one agent template serves all customers.

@router.post("/pre-call")
async def pre_call_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    
    # Telnyx tells us which number was called
    called_number = body.get("telnyx_agent_target")
    caller_number = body.get("telnyx_end_user_target")
    conversation_id = body.get("conversation_id")
    
    # Find which customer owns this number
    result = await db.execute(
        select(Agent).where(Agent.telnyx_phone_number == called_number)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        # Number not found — return empty variables, agent uses defaults
        return {"dynamic_variables": {}}
    
    # Load customer profile
    customer = await db.get(Customer, agent.customer_id)
    
    # Return variables injected into agent's system prompt and greeting
    return {
        "dynamic_variables": {
            "var_office_name": customer.business_name,
            "var_calendar_id": customer.google_calendar_id or "",
            "var_customer_id": str(customer.id),
            "var_agent_id": str(agent.id),
        }
    }


# ─── POST-CALL WEBHOOK ─────────────────────────────────────────────────────────
# Telnyx calls this at the END of every call.
# We store transcript, generate summary, send push notification.

@router.post("/post-call")
async def post_call_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    
    conversation_id = body.get("conversation_id")
    duration = body.get("duration_seconds", 0)
    transcript = body.get("transcript", "")
    insights = body.get("insights", {})
    caller_number = body.get("caller_number", "")
    
    # Find the call's agent via conversation_id metadata
    # (Telnyx includes the phone number in the payload)
    called_number = body.get("called_number")
    result = await db.execute(
        select(Agent).where(Agent.telnyx_phone_number == called_number)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        return {"status": "ok"}
    
    # 1. Store call record
    call = Call(
        customer_id=agent.customer_id,
        agent_id=agent.id,
        telnyx_conversation_id=conversation_id,
        caller_number=caller_number,
        duration_seconds=str(duration),
        transcript=transcript,
        appointment_booked=insights.get("appointment_booked", False),
        sentiment=insights.get("sentiment", "neutral")
    )
    db.add(call)
    await db.flush()
    
    # 2. Generate AI summary (async, doesn't block response)
    summary = await generate_call_summary(transcript, insights)
    call.ai_summary = summary
    
    # 3. Send push notification to customer
    customer = await db.get(Customer, agent.customer_id)
    appointment_text = "Ραντεβού κλείστηκε ✓" if insights.get("appointment_booked") else ""
    push_message = f"Νέα κλήση από {caller_number}. {appointment_text}"
    
    await PushService.send(customer.id, title="VoiceForge", body=push_message)
    
    await db.commit()
    return {"status": "ok"}


async def generate_call_summary(transcript: str, insights: dict) -> str:
    """Generates a 1-3 sentence AI summary of the call."""
    # Simple summary for now — can upgrade to LLM call later
    if not transcript:
        return "Κλήση χωρίς μεταγραφή."
    intent = insights.get("intent", "general inquiry")
    booked = "Ραντεβού κλείστηκε." if insights.get("appointment_booked") else ""
    return f"Κλήση με θέμα: {intent}. {booked}".strip()
```

### 2.6 routers/tools.py — Calendar Tool Webhooks
```python
# backend/routers/tools.py
# Telnyx AI agent calls these DURING the call in real-time
from fastapi import APIRouter, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.customer import Customer
from services.calendar_service import CalendarService
from fastapi import Depends
from datetime import datetime, timedelta

router = APIRouter(prefix="/tools", tags=["ai-tools"])


@router.post("/calendar/check")
async def check_calendar(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Called by the AI agent during a live call.
    Returns available appointment slots.
    Response must be fast (< 2 seconds) or Telnyx times out.
    """
    body = await request.json()
    requested_date = body.get("requested_date")  # YYYY-MM-DD
    customer_id = body.get("customer_id")
    
    customer = await db.get(Customer, customer_id)
    if not customer or not customer.google_oauth_token:
        return {
            "available_slots": ["10:00", "11:00", "14:00", "15:00"],
            "message": f"Διαθέσιμες ώρες για {requested_date}: 10:00, 11:00, 14:00, 15:00"
        }
    
    # Query Google Calendar
    calendar = CalendarService(customer.google_oauth_token)
    slots = await calendar.get_free_slots(requested_date, customer.google_calendar_id)
    
    slots_str = ", ".join(slots) if slots else "δεν υπάρχουν διαθέσιμες ώρες"
    return {
        "available_slots": slots,
        "message": f"Διαθέσιμες ώρες για {requested_date}: {slots_str}"
    }


@router.post("/calendar/book")
async def book_appointment(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Called by the AI agent to actually book the appointment.
    """
    body = await request.json()
    date = body.get("date")
    time = body.get("time")
    caller_name = body.get("caller_name")
    caller_phone = body.get("caller_phone")
    notes = body.get("notes", "")
    customer_id = body.get("customer_id")
    
    customer = await db.get(Customer, customer_id)
    if not customer or not customer.google_oauth_token:
        return {"success": True, "message": f"Ραντεβού καταχωρήθηκε για {date} στις {time}"}
    
    calendar = CalendarService(customer.google_oauth_token)
    event_id = await calendar.create_event(
        date=date,
        time=time,
        title=f"Ραντεβού - {caller_name}",
        description=f"Τηλέφωνο: {caller_phone}\n{notes}",
        calendar_id=customer.google_calendar_id
    )
    
    return {
        "success": True,
        "event_id": event_id,
        "message": f"Ραντεβού κλείστηκε για {date} στις {time}. Θα λάβετε επιβεβαίωση."
    }
```

### 2.7 routers/agents.py — Agent CRUD
```python
# backend/routers/agents.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.customer import Customer, Agent
from services.telnyx import telnyx_service
from pydantic import BaseModel

router = APIRouter(prefix="/agents", tags=["agents"])


class AgentLaunchRequest(BaseModel):
    industry: str           # law | medical | realestate | beauty | custom
    agent_name: str         # "Sofia"
    office_name: str        # "Δικηγορικό Γραφείο Παπαδόπουλου"
    instructions: str       # Full system prompt
    greeting: str           # First message
    voice: str              # "el-GR-AthinaNeural"
    phone_number: str       # Selected +30 number


@router.post("/launch")
async def launch_agent(
    payload: AgentLaunchRequest,
    customer_id: str,  # From JWT auth middleware
    db: AsyncSession = Depends(get_db)
):
    """
    The BIG endpoint. Called when user clicks "Launch My Agent".
    Does 4 Telnyx API calls in sequence (could parallelise some).
    Total time target: < 30 seconds.
    """
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Step 1: Create Telnyx sub-account (if not already created)
    if not customer.telnyx_account_id:
        sub = await telnyx_service.create_sub_account(customer.business_name)
        customer.telnyx_account_id = sub["managed_account_id"]
        customer.telnyx_api_key = sub["api_key"]
        await db.flush()
    
    api_key = customer.telnyx_api_key
    
    # Step 2: Create AI assistant
    assistant_id = await telnyx_service.create_assistant(
        customer_api_key=api_key,
        name=f"{payload.agent_name} - {payload.office_name}",
        instructions=payload.instructions,
        greeting=payload.greeting,
        voice=payload.voice,
        industry=payload.industry
    )
    
    # Step 3: Purchase phone number
    await telnyx_service.purchase_number(payload.phone_number, api_key)
    
    # Step 4: Assign number to assistant
    await telnyx_service.assign_number_to_assistant(
        phone_number=payload.phone_number,
        assistant_id=assistant_id,
        customer_api_key=api_key
    )
    
    # Step 5: Save agent to DB
    agent = Agent(
        customer_id=customer.id,
        telnyx_assistant_id=assistant_id,
        telnyx_phone_number=payload.phone_number,
        name=payload.agent_name,
        industry=payload.industry,
        instructions=payload.instructions,
        greeting=payload.greeting,
        voice=payload.voice,
        is_live=True
    )
    db.add(agent)
    customer.onboarding_complete = True
    
    await db.commit()
    await db.refresh(agent)
    
    return {
        "agent_id": str(agent.id),
        "phone_number": payload.phone_number,
        "assistant_id": assistant_id,
        "status": "live",
        "message": "Ο agent σας είναι ζωντανός! Κάντε forward τις κλήσεις σας στον αριθμό."
    }


@router.get("/numbers/available")
async def get_available_numbers(customer_id: str, db: AsyncSession = Depends(get_db)):
    """Returns available Greek +30 numbers for the picker."""
    customer = await db.get(Customer, customer_id)
    
    # Use sub-account key if exists, else master key for browsing
    api_key = customer.telnyx_api_key if customer.telnyx_api_key else None
    if not api_key:
        # Create sub-account first if needed
        sub = await telnyx_service.create_sub_account(customer.business_name)
        customer.telnyx_account_id = sub["managed_account_id"]
        customer.telnyx_api_key = sub["api_key"]
        await db.commit()
        api_key = sub["api_key"]
    
    numbers = await telnyx_service.list_available_greek_numbers(api_key)
    return {"numbers": [n["phone_number"] for n in numbers]}
```

### 2.8 main.py — FastAPI App Entry Point
```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from database import engine, Base
from routers import agents, webhooks, tools, auth, calls, billing, calendar, notifications

app = FastAPI(
    title="VoiceForge AI API",
    version="1.0.0",
    docs_url="/docs" if settings.environment == "development" else None
)

# CORS — allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(webhooks.router)
app.include_router(tools.router)
app.include_router(calls.router)
app.include_router(billing.router)
app.include_router(calendar.router)
app.include_router(notifications.router)


@app.on_event("startup")
async def startup():
    # Create DB tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ VoiceForge AI backend started")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.environment}
```

---

## PHASE 3 — RUN & TEST (Day 3)

### 3.1 Εκκίνηση backend
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Θα δεις:
# ✅ VoiceForge AI backend started
# INFO:     Uvicorn running on http://0.0.0.0:8000
# Docs: http://localhost:8000/docs
```

### 3.2 ngrok για webhooks (νέο terminal)
```bash
# Νέο terminal tab
ngrok http 8000

# Θα σου δώσει URL τύπου:
# https://abc123.ngrok.io

# Αντέγραψε αυτό το URL και βάλε το στο .env:
# API_BASE_URL=https://abc123.ngrok.io

# Επανεκκίνηση του backend μετά
```

### 3.3 Test δημιουργία sub-account (το πρώτο σημαντικό test)
```bash
# Σε νέο terminal, με ενεργό venv:
python << 'EOF'
import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

async def test():
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.telnyx.com/v2/managed_accounts",
            headers={
                "Authorization": f"Bearer {os.getenv('TELNYX_API_KEY')}",
                "Content-Type": "application/json"
            },
            json={"business_name": "TEST - Law Office Demo"}
        )
        print(r.status_code)
        print(r.json())

asyncio.run(test())
EOF

# Αν βγει 200 → Managed Accounts είναι ενεργό, μπορούμε να προχωρήσουμε
# Αν βγει 403 → Δεν έχει εγκριθεί ακόμα → περιμένουμε
```

### 3.4 Test ελληνικής φωνής
```bash
# Δημιούργησε test assistant απευθείας στο Telnyx portal:
# portal.telnyx.com → AI Assistants → New Assistant
# Voice: Azure → el-GR-AthinaNeural
# Greeting: "Γεια σας! Πώς μπορώ να σας βοηθήσω;"
# Assign your test +30 number
# → Κάλεσε τον αριθμό από κινητό
# → Αξιολόγησε ποιότητα φωνής
```

---

## PHASE 4 — FRONTEND (Week 2-3)

### 4.1 Setup React + Vite
```bash
cd frontend
pnpm create vite . --template react
pnpm install
pnpm install axios @tanstack/react-query react-router-dom
pnpm install tailwindcss @tailwindcss/vite
pnpm install lucide-react framer-motion
pnpm install @supabase/supabase-js

# shadcn/ui setup
pnpm dlx shadcn@latest init
# → TypeScript: No
# → Style: Default
# → Color: Slate
# → CSS variables: Yes

pnpm dlx shadcn@latest add button card input progress badge
```

### 4.2 Onboarding Wizard — Step 1 (Industry Selection)
```jsx
// frontend/src/pages/Onboarding/Step1_Industry.jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"

const INDUSTRIES = [
  { id: "law", icon: "⚖️", label: "Law Office", description: "Δικηγορικό γραφείο / Solo lawyer" },
  { id: "medical", icon: "🏥", label: "Medical Practice", description: "Ιατρείο / Κλινική" },
  { id: "realestate", icon: "🏠", label: "Real Estate", description: "Μεσιτικό γραφείο" },
  { id: "beauty", icon: "💅", label: "Beauty & Wellness", description: "Κομμωτήριο / Spa / Κλινική αισθητικής" },
  { id: "accounting", icon: "📊", label: "Accounting", description: "Λογιστικό γραφείο" },
  { id: "custom", icon: "⚙️", label: "Custom", description: "Προσαρμοσμένο για οποιαδήποτε επιχείρηση" },
]

export default function Step1_Industry() {
  const [selected, setSelected] = useState(null)
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            What type of business are you?
          </h1>
          <p className="text-slate-500">We'll set up the perfect AI agent template for you</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-8">
          {INDUSTRIES.map(ind => (
            <button
              key={ind.id}
              onClick={() => setSelected(ind.id)}
              className={`p-6 rounded-2xl border-2 text-left transition-all ${
                selected === ind.id
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="text-3xl mb-2">{ind.icon}</div>
              <div className="font-semibold text-slate-900">{ind.label}</div>
              <div className="text-sm text-slate-500 mt-1">{ind.description}</div>
            </button>
          ))}
        </div>
        
        <button
          disabled={!selected}
          onClick={() => navigate("/onboarding/2", { state: { industry: selected } })}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg disabled:opacity-40 hover:bg-blue-700 transition"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
```

### 4.3 Onboarding Wizard — Step 5 (Launch)
```jsx
// frontend/src/pages/Onboarding/Step5_Launch.jsx
import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import api from "@/services/api"

const STEPS = [
  "Creating your Telnyx account...",
  "Building your AI agent...",
  "Purchasing your phone number...",
  "Connecting everything...",
  "Your agent is LIVE! 🎉"
]

export default function Step5_Launch() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleLaunch() {
    setCurrentStep(0)
    try {
      for (let i = 0; i < STEPS.length - 1; i++) {
        setCurrentStep(i)
        await new Promise(r => setTimeout(r, 800)) // UI feedback
      }
      
      const response = await api.post("/agents/launch", {
        industry: state.industry,
        agent_name: state.agentName,
        office_name: state.officeName,
        instructions: state.instructions,
        greeting: state.greeting,
        voice: state.voice,
        phone_number: state.phoneNumber
      })
      
      setCurrentStep(4)
      setResult(response.data)
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong")
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Your AI Agent is Live!</h1>
          <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 mb-6">
            <p className="text-slate-500 mb-2">Your phone number</p>
            <p className="text-2xl font-mono font-bold text-blue-600">{result.phone_number}</p>
          </div>
          <p className="text-slate-600 mb-8">
            Forward your calls to this number and your AI agent will handle everything.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700"
          >
            Go to Dashboard →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Ready to launch? 🚀</h1>
        <p className="text-slate-500 mb-10">Your AI agent will be live in under 30 seconds</p>
        
        {currentStep !== null && (
          <div className="mb-8 space-y-3">
            {STEPS.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${
                i < currentStep ? "text-green-600" :
                i === currentStep ? "text-blue-600 font-semibold" :
                "text-slate-400"
              }`}>
                <span>{i < currentStep ? "✅" : i === currentStep ? "⏳" : "○"}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6">{error}</div>
        )}
        
        {currentStep === null && (
          <button
            onClick={handleLaunch}
            className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold text-xl hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-200 transition"
          >
            🚀 Launch My Agent
          </button>
        )}
      </div>
    </div>
  )
}
```

---

## PHASE 5 — END-TO-END TEST (Week 3 — The Milestone)

### Test checklist — αυτά πρέπει να δουλεύουν όλα μαζί:

```
[ ] 1. User registers → Supabase auth creates user
[ ] 2. User completes wizard → /agents/launch called
[ ] 3. Telnyx sub-account created → ID saved in DB
[ ] 4. AI assistant created in Telnyx sub-account
[ ] 5. +30 number purchased and assigned to assistant
[ ] 6. Call the +30 number from a real phone
[ ] 7. Agent answers in Greek with correct greeting
[ ] 8. Ask for appointment → agent calls /tools/calendar/check
[ ] 9. Book appointment → /tools/calendar/book → Google Calendar event created
[ ] 10. Call ends → /telnyx/post-call fires → transcript saved
[ ] 11. Push notification appears on customer's browser
[ ] 12. Dashboard shows the call with transcript + summary
```

**Αν όλα τα 12 δουλεύουν → το core platform είναι proven. Όλα τα επόμενα είναι UI και billing.**

---

## QUICK REFERENCE — Commands που χρησιμοποιούμε συνεχώς

```bash
# Backend
cd backend && uvicorn main:app --reload --port 8000

# Frontend
cd frontend && pnpm dev

# ngrok (webhooks)
ngrok http 8000

# DB migrations (αν χρειαστεί)
alembic revision --autogenerate -m "description"
alembic upgrade head

# Git
git add -A && git commit -m "feat: description"

# Test single endpoint
curl -X POST http://localhost:8000/agents/numbers/available \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "xxx"}'

# Logs
tail -f backend/app.log
```

---

## NEXT SESSION CHECKLIST

Κάθε φορά που ανοίγουμε VS Code, ελέγχουμε:

```
[ ] telnyx_api_key στο .env είναι συμπληρωμένο
[ ] ngrok τρέχει και το URL είναι ενημερωμένο στο .env
[ ] supabase project είναι ενεργό (free tier παύει μετά από αδράνεια)
[ ] uvicorn backend τρέχει στο port 8000
[ ] vite frontend τρέχει στο port 5173
```

---

*VoiceForge AI — Internal Dev Roadmap | Panos Skouras | Feb 2026*

"""
Gemini API integration for Sokoni Chat.
Uses gemini-2.5-flash via the google-genai SDK (v1.x).
"""

import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# Initialise client once at module load
_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """
You are Sokoni, a friendly and helpful AI marketplace assistant for a hyperlocal community app in Uganda.
Your primary goal is to connect users (consumers) with nearby vendors for products and services.

CORE BEHAVIOR
- Identify Intent: Understand what the user is looking for (product or service) and their location.
  If either is missing, gently ask for it.
- Language: Reply in the SAME language the user used. If they write in Luganda, reply in Luganda.
- Privacy: NEVER show or request personal contact information (phone numbers, emails).
- Be warm, concise, and conversational. This is a mobile chat app.

DIALOGUE & CLARIFICATION
- Welcome new users with: "Hi! I'm Sokoni, your market assistant. Tell me what you need and where you are."
- If the request is vague, ask a clarifying question and provide clickable button options.
  IMPORTANT: Output ONLY the raw JSON below — no extra text before or after it:
  {
    "type": "quick_reply",
    "reply": "Sure, I can help! What kind of device needs fixing?",
    "buttons": ["Smartphone Repair", "Laptop Repair", "Feature Phone Repair", "General Electronics"]
  }

SEARCH INTENT FORMAT
When you have BOTH a clear service/product category AND a location, output ONLY this JSON — no extra text before or after:
{
  "type": "search_intent",
  "category": "<category keyword, e.g. plumber, tailor, phone repair, bakery, salon>",
  "location": "<area name, e.g. Nakawa, Wandegeya>",
  "clarifying_reply": "<friendly sentence like 'Great! Searching for plumbers near Nakawa...'>"
}

CATEGORY KEYWORDS (use these exact strings when possible):
fresh food, bakery, tailoring, phone repair, electronics repair, plumbing, handyman,
salon, beauty, cleaning, laundry, grocery, hardware, pharmacy, printing, catering,
photography, tutoring, transport, mechanic

LOCATION KEYWORDS (Kampala areas):
Wandegeya, Nakawa, Kisasi, Old Kampala, Kalerwe, Ntinda, Bukoto, Kololo,
Makerere, Mulago, Bwaise, Kawempe, Nansana, Kireka, Luzira, Muyenga, Bugolobi, Naguru

OTHER RULES
- For non-market questions, politely redirect: "I'm best at helping you find services and products nearby."
- Never hallucinate vendor data. The backend will do the actual database lookup.
- Keep replies short — users are on mobile.
"""


async def get_gemini_response(user_message: str, conversation_history: list) -> str:
    """
    Send a message to Gemini 2.5 Flash and return the text response.

    Args:
        user_message: The latest message from the user.
        conversation_history: List of {"role": "user"|"model", "content": "..."} dicts.

    Returns:
        The model's text response as a string.
    """
    # Build contents list from history + new message
    contents = []
    for turn in conversation_history:
        role = turn.get("role", "user")
        text = turn.get("content", "")
        if text:
            contents.append(types.Content(
                role=role,
                parts=[types.Part(text=text)]
            ))

    # Add the new user message
    contents.append(types.Content(
        role="user",
        parts=[types.Part(text=user_message)]
    ))

    response = await _client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.7,
        ),
    )

    return response.text

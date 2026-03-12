from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings
from app.agents.state.schemas import AgentState


SYNTHESIS_PROMPT = """You are a senior financial analyst at FinSight AI.

Original Question: {query}

== DOCUMENT ANALYSIS ==
{rag_results}

== LIVE STOCK DATA ==
{finance_results}

== FUNDAMENTAL ANALYSIS (Alpha Vantage) ==
{alpha_vantage_results}

== MARKET NEWS ==
{web_results}

== FINANCIAL NEWS ARTICLES ==
{news_results}

== AGENT REASONING ==
{reasoning}

Write a comprehensive financial research response:

## Summary
[2-3 sentence direct answer]

## Detailed Analysis
[Integrate all data sources with specific numbers]

## Key Risks
[Important risks and caveats]

## Sources & Data Used
[List which tools provided what data]

Rules:
- Never invent numbers or data
- Clearly note when data is unavailable
- Use specific figures from the data provided
- Be professional but accessible"""


async def answerer_node(state: AgentState) -> AgentState:
    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=0.3,
        convert_system_message_to_human=True,
    )

    prompt = SYNTHESIS_PROMPT.format(
        query=state["user_query"],
        rag_results=state.get("rag_results") or "No documents searched.",
        finance_results=state.get("finance_results") or "No live stock data fetched.",
        alpha_vantage_results=state.get("alpha_vantage_results") or "No fundamental data fetched.",
        web_results=state.get("web_results") or "No web search performed.",
        news_results=state.get("news_results") or "No news articles fetched.",
        reasoning=state.get("reasoning", ""),
    )

    response = llm.invoke(prompt)

    return {
        **state,
        "final_answer": response.content,
        "llm_calls": state.get("llm_calls", 0) + 1,
    }
from app.agents.react_agent import run_agentic_query


class AgentService:
    """High-level service wrapping the agentic RAG."""
    
    async def process_query(self, query: str) -> dict:
        """Process a query through the full agentic pipeline."""
        result = await run_agentic_query(query)
        return result


agent_service = AgentService()
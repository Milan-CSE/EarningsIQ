from fastapi import FastAPI

app = FastAPI(title="EarningsIQ API")

@app.get("/health")
def health_check():
    return {"status": "alive", "service": "EarningsIQ Newsroom"}
import psycopg2

DB_CONFIG = {
    "host": "localhost",
    "port": "5433",
    "dbname": "earningsiq",
    "user": "admin",
    "password": "adminpassword"
}

def init_postgres():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # 1. Enable pgvector extension inside the database
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    
    # 2. Table preserving full financial context
    cur.execute("""
        CREATE TABLE IF NOT EXISTS filing_sections (
            id SERIAL PRIMARY KEY,
            cik VARCHAR(10) NOT NULL,
            company_name TEXT NOT NULL,
            filing_type VARCHAR(10) NOT NULL,
            reporting_period TEXT,
            section TEXT NOT NULL,
            subsection TEXT,
            content_type VARCHAR(20) NOT NULL, -- 'prose' or 'table'
            content TEXT NOT NULL,             -- raw prose or markdown table
            table_context TEXT,
            source_location TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    conn.commit()
    cur.close()
    conn.close()
    print("PostgreSQL table 'filing_sections' and vector extension initialized.")

if __name__ == "__main__":
    init_postgres()
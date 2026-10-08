import psycopg2

DB_CONFIG = {
    "host": "localhost",
    "port": "5433",
    "dbname": "earningsiq",
    "user": "admin",
    "password": "adminpassword"
}

def inspect_chunks():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    cur.execute("SELECT chunk_type, COUNT(*) FROM filing_chunks GROUP BY chunk_type;")
    for chunk_type, count in cur.fetchall():
        print(f"Chunk Type: {chunk_type:<15} | Count: {count}")

    print("\n" + "=" * 60)
    print("SAMPLE CHUNK CONTENT (Search-Ready Index Card)")
    print("=" * 60)
    cur.execute("""
        SELECT chunk_id, section, chunk_type, chunk_content, source_location
        FROM filing_chunks
        LIMIT 1;
    """)
    cid, section, ctype, content, loc = cur.fetchone()
    print(f"ID:       {cid}")
    print(f"Section:  {section}")
    print(f"Type:     {ctype}")
    print(f"Location: {loc}\n")
    print("Preview:\n" + "-" * 40)
    print(content[:500] + ("..." if len(content) > 500 else ""))

    cur.close()
    conn.close()

if __name__ == "__main__":
    inspect_chunks()
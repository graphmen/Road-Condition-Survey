"""
Database migration script for Supabase / PostgreSQL + PostGIS.
Connects directly to the PostgreSQL instance and runs the schema SQL.
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load env variables from backend/.env if running from workspace root or backend dir
load_dotenv()
if os.path.exists(".env"):
    load_dotenv(".env")
elif os.path.exists("backend/.env"):
    load_dotenv("backend/.env")

def migrate():
    # Retrieve postgres connection string from environment
    # Fallback to the explicit connection string provided by the user if not in env
    postgres_url = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:Thandolwekosi25!@db.kchmhpwmyubesocdssga.supabase.co:5432/postgres"
    )
    
    print(f"Connecting to database to run migrations...")
    try:
        conn = psycopg2.connect(postgres_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Read the schema file
        schema_path = "supabase_schema.sql"
        if not os.path.exists(schema_path) and os.path.exists("backend/supabase_schema.sql"):
            schema_path = "backend/supabase_schema.sql"
            
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_sql = f.read()
            
        print("Executing SQL schema migration...")
        cursor.execute(schema_sql)
        print("✅ Database migrations executed successfully!")
        
        # Verify table exists
        cursor.execute("SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'road_surveys');")
        table_exists = cursor.fetchone()[0]
        print(f"Table 'road_surveys' exists: {table_exists}")
        
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Migration failed: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)

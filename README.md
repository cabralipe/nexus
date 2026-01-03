<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1wejKg5CA5BV_7JrQI8iTwM66TcYDkVA1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure the frontend API base URL (optional):
   - Create `.env.local` and set `VITE_API_BASE_URL=http://localhost:8000/api`
3. Run the app:
   `npm run dev`

## Backend (Django)

1. Create a virtual environment and install dependencies:
   `python -m venv .venv && source .venv/bin/activate`
   `pip install -r backend/requirements.txt`
2. Create the database and user:
   - `psql -U postgres -c "CREATE USER nexus WITH PASSWORD 'nexus';"`
   - `psql -U postgres -c "CREATE DATABASE nexus OWNER nexus;"`
3. Set environment variables:
   - Copy `backend/.env.example` to `backend/.env` and update `GEMINI_API_KEY`
   - Adjust `DJANGO_DB_*` if you use different credentials
   - The backend loads `backend/.env` automatically
4. Run the server:
   `python backend/manage.py migrate`
   `python backend/manage.py runserver 0.0.0.0:8000`

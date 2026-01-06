#!/usr/bin/env python
import os
import sys


from dotenv import load_dotenv

def main() -> None:
    # Load environment variables from .env file
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nexus_backend.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and available on your PYTHONPATH?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()

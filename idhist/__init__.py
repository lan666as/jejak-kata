"""Diachronic word profiles for Indonesian and the regional languages of Indonesia."""

import os

# Parallel workers for the heavy stages. Set IDHIST_WORKERS=1 on a shared machine.
WORKERS = int(os.environ.get("IDHIST_WORKERS", os.cpu_count() or 1))

FROM python:3.12-slim
RUN pip install --no-cache-dir numpy pandas psutil
RUN useradd -m -u 1000 runner
USER 1000
WORKDIR /code

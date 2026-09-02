FROM python:3.10-slim

ENV PIP_NO_CACHE_DIR=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/vanta

RUN git clone https://github.com/taoshidev/vanta-network.git .
RUN pip install -r requirements.txt
RUN pip install -e .
RUN pip install git+https://github.com/taoshidev/vanta-cli.git

COPY start.sh /opt/deploytao/start.sh
RUN chmod +x /opt/deploytao/start.sh

EXPOSE 8088

ENTRYPOINT ["/opt/deploytao/start.sh"]

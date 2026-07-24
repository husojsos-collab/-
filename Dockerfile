FROM node:20-bookworm-slim

# تثبيت أدوات النظام المطلوبة
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openssh-client \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# تحويل كافة بروتوكولات GitHub إلى HTTPS لضمان عدم رفض التحميل
RUN git config --global url."https://github.com/".insteadOf ssh://git@github.com/ \
    && git config --global url."https://github.com/".insteadOf git@github.com: \
    && git config --global url."https://github.com/".insteadOf git://github.com/ \
    && git config --global url."https://github.com/".insteadOf git+https://github.com/

WORKDIR /app

COPY package*.json ./

# تثبيت الحزم مع حفل خيار للتوافق
RUN npm install --omit=dev --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]

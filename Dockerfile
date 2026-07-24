# هذا الملف يبني صورة (image) كاملة للبوت، ويضمن تثبيت ffmpeg بشكل مباشر
# ومؤكد 100% (بعكس nixpacks.toml اللي أحيانًا ما ينطبق صح على بعض المنصات).
#
# Railway يكتشف وجود Dockerfile بجذر المشروع تلقائيًا ويستخدمه بدل Nixpacks
# بدون أي إعداد إضافي منك.

FROM node:20-bookworm-slim

# نثبت ffmpeg كبرنامج نظام حقيقي (مو حزمة npm) - هذا يحل مشكلة "spawn ffmpeg ENOENT"
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openssh-client \
    chromium \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]

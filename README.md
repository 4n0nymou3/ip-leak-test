# 🚀 راهنمای نصب Cloudflare Worker

## مرحله 1: ایجاد Cloudflare Worker

1. به سایت [Cloudflare Dashboard](https://dash.cloudflare.com/) بروید
2. وارد حساب کاربری خود شوید
3. از منوی سمت چپ روی **Workers & Pages** کلیک کنید
4. روی دکمه **Create Application** کلیک کنید
5. **Create Worker** را انتخاب کنید
6. یک نام برای Worker خود انتخاب کنید (مثلاً: `ip-leak-api`)
7. روی **Deploy** کلیک کنید

## مرحله 2: کپی کردن کد Worker

1. بعد از ساخت Worker، روی **Edit Code** کلیک کنید
2. تمام کد موجود را پاک کنید
3. کد فایل `cloudflare-worker.js` را کپی و در ادیتور Paste کنید
4. روی **Save and Deploy** کلیک کنید

## مرحله 3: دریافت URL Worker

بعد از Deploy شدن، یک URL مانند این دریافت می‌کنید:

```
https://ip-leak-api.YOUR-SUBDOMAIN.workers.dev
```

این URL را کپی کنید.

## مرحله 4: تنظیم URL در پروژه

1. فایل `js/config.js` را باز کنید
2. در ابتدای فایل، خط زیر را پیدا کنید:

```javascript
worker: {
    apiUrl: 'https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev',
    enabled: true
},
```

3. `https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev` را با URL Worker خودتان جایگزین کنید

مثال:
```javascript
worker: {
    apiUrl: 'https://ip-leak-api.myusername.workers.dev',
    enabled: true
},
```

4. فایل را ذخیره کنید

## مرحله 5: تست کردن

1. صفحه وب را باز کنید یا Refresh کنید
2. به تب **DNS Test** بروید - باید بخش "Advanced DNS Leak Detection" را ببینید
3. به تب **Proxy/VPN Detection** بروید - باید نتایج تشخیص Proxy/VPN/Tor را ببینید

## غیرفعال کردن Worker (اختیاری)

اگر می‌خواهید موقتاً Worker را غیرفعال کنید:

```javascript
worker: {
    apiUrl: 'https://ip-leak-api.myusername.workers.dev',
    enabled: false  // تغییر از true به false
},
```

## تست API Endpoints

می‌توانید مستقیماً endpoints را تست کنید:

1. DNS Leak: `https://YOUR-WORKER.workers.dev/api/dns-leak`
2. Advanced IP: `https://YOUR-WORKER.workers.dev/api/advanced-ip`
3. Proxy Detection: `https://YOUR-WORKER.workers.dev/api/proxy-detection`

## نکات مهم

- ✅ Worker رایگان است (تا 100,000 request در روز)
- ✅ هیچ نیازی به کارت اعتباری نیست
- ✅ CORS به صورت خودکار فعال است
- ✅ تمام داده‌ها از طریق HTTPS ارسال می‌شوند

## عیب‌یابی

**مشکل: Worker کار نمی‌کند**
- بررسی کنید که URL را درست کپی کرده‌اید
- بررسی کنید که `enabled: true` باشد
- Console مرورگر را چک کنید (F12)

**مشکل: CORS Error**
- Worker باید Deploy شده باشد
- کد Worker را دوباره چک کنید

## پشتیبانی

اگر مشکلی داشتید، Console مرورگر (F12) را باز کنید و پیام‌های خطا را بررسی کنید.

## توسعه‌دهنده
Anonymous
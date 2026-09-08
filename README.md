# Araba Yarışı

**Kurulum durumu:** Oyun kodları aktarıldı. Karakter fotoğrafları ve yüz modelleri, herkese açık paylaşım onayı beklediği için henüz eklenmedi. Bu dört dosya tamamlanmadan karakter seçimi ve yayın hazır değildir.

3D karakter seçimi, tablet dokunmatik kontrolleri ve oda koduyla iki kişilik online yarış.

## Yayınla

[Render üzerinde oyunu yayınla](https://render.com/deploy?repo=https://github.com/yavuzselimerdogann318924/araba-yarisi)

GitHub ile giriş yapıp kurulumu onayla. Depodaki render.yaml oyunu ve gerçek zamanlı sunucuyu aynı adreste çalıştırır. Kurulum tamamlandığında Render bir HTTPS oyun adresi verir. İstersen daha sonra kendi alan adını bağlayabilirsin. ChatGPT Sites bağlantısı gerekmez.

Ücretsiz sunucu kullanılmadığında uyuyabilir; ilk açılış bekletebilir. Ücretsiz planın kaynakları sınırlıdır. Aktif yarış odaları bellekte tutulur; sunucu yeniden başlarsa veya oyuncu ayrılırsa yeni oda gerekir. Tek sunucu örneği kullanılmalıdır.

## Oyna

Karakter seç → ONLINE · 2 KİŞİ → Oda oluştur. Arkadaşın aynı siteyi açıp altı haneli kodu girsin. Oda sahibi yarışı başlatır. İki insan oyuncuya dört bilgisayar arabası eşlik eder. Duraklatma iki oyuncuyu da durdurur.

Tablette yön ile gaz düğmelerine birlikte basabilirsin. Bilgisayarda WASD/ok tuşları, Shift turbo, Space el freni, R piste dön, C kamera.

## Yerel çalıştırma

Node.js 24 ile `npm ci`, ardından `npm start`. Tarayıcıda http://localhost:3000 adresini aç. Kontroller: `npm test`.

Sunucu fiziği mesaj geliş hızından bağımsız 60 Hz çalıştırır; görüntü durumlarını 20 Hz gönderir. WebSocket yolu `/online`, sağlık kontrolü `/health`. Oda üyeliği bağlantıya bağlıdır. Odalar 30 dakika sonra kapanır.

Ayrı bir statik site kullanılırsa dist/server-config.js içine kendi wss://sunucu/online adresini yaz ve sunucudaki ALLOWED_ORIGINS değerine site adresini ekle. Aynı alan adında ek ayar gerekmez.

Fotoğraflardan oluşturulan yüz derinliği tahminidir; tam baş taraması değildir. Three.js lisansı dist/vendor/THREE-LICENSE.txt içindedir.

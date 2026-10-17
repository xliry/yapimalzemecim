// Original supplied product photography; responsive variants are generated at build time.
export const productMedia = {
  "filmli-plywood-paketleri": {
    "source": "public/assets/catalog/filmli-plywood-paketleri.jpg",
    "width": 1152,
    "height": 2048,
    "alt": "Depoda istiflenmiş koyu film yüzeyli plywood paketleri",
    "position": "50% 50%",
    "cardPosition": "65% 65%"
  },
  "plywood-santiye": {
    "source": "public/assets/catalog/plywood-santiye.jpg",
    "width": 1200,
    "height": 1600,
    "alt": "Şantiyede kullanılan filmli plywood kalıp levhaları",
    "position": "50% 50%",
    "cardPosition": "50% 50%"
  },
  "kontrplak-dogal-yuzey": {
    "source": "public/assets/catalog/kontrplak-dogal-yuzey.jpg",
    "width": 1152,
    "height": 2048,
    "alt": "Ham kontrplak levhanın doğal ahşap yüzeyi",
    "position": "50% 50%",
    "cardPosition": "50% 47%"
  },
  "kontrplak-yuzey-kenar": {
    "source": "public/assets/catalog/kontrplak-yuzey-kenar.jpg",
    "width": 1080,
    "height": 1920,
    "alt": "Ham kontrplak levhada yüzey ve katmanlı kenar detayı",
    "position": "50% 50%",
    "cardPosition": "50% 50%"
  },
  "kontrplak-istif": {
    "source": "public/assets/catalog/kontrplak-istif.jpg",
    "width": 1080,
    "height": 1920,
    "alt": "Depoda üst üste istiflenmiş kontrplak levhalar",
    "position": "50% 50%",
    "cardPosition": "50% 50%"
  },
  "kontrplak-katman": {
    "source": "public/assets/catalog/kontrplak-katman.jpg",
    "width": 1080,
    "height": 1920,
    "alt": "Kontrplak levhaların katmanlı kenarlarının yakın görünümü",
    "position": "50% 50%",
    "cardPosition": "50% 50%"
  },
  "setboard-osb-paketleri": {
    "source": "public/assets/catalog/setboard-osb-paketleri.jpg",
    "width": 1200,
    "height": 1600,
    "alt": "Depodaki SETBOARD etiketli OSB levha paketleri",
    "position": "50% 50%",
    "cardPosition": "50% 53%"
  },
  "setboard-osb-detay": {
    "source": "public/assets/catalog/setboard-osb-detay.jpg",
    "width": 963,
    "height": 1177,
    "alt": "SETBOARD OSB paketlerinde ambalaj ve ürün etiketi detayı",
    "position": "50% 50%",
    "cardPosition": "50% 50%"
  },
  "kereste-istifi": {
    "source": "public/assets/catalog/kereste-istifi.jpg",
    "width": 1536,
    "height": 2048,
    "alt": "Açık alanda düzenli biçimde istiflenmiş inşaatlık kereste",
    "position": "50% 50%",
    "cardPosition": "50% 45%"
  },
  "kereste-tahta-istifi": {
    "source": "public/assets/catalog/kereste-tahta-istifi.jpg",
    "width": 1200,
    "height": 1600,
    "alt": "Üst üste yerleştirilmiş kereste ve tahta istifi",
    "position": "50% 50%",
    "cardPosition": "50% 50%"
  },
  "kereste-kesit": {
    "source": "public/assets/catalog/kereste-kesit.jpg",
    "width": 1200,
    "height": 1600,
    "alt": "Kereste uç kesitleri ve ahşap yüzey dokusu",
    "position": "50% 50%",
    "cardPosition": "50% 50%"
  },
  "kereste-olcum": {
    "source": "public/assets/catalog/kereste-olcum.jpg",
    "width": 900,
    "height": 1600,
    "alt": "Kereste üzerinde ölçü ve yüzey detayı",
    "position": "50% 50%",
    "cardPosition": "50% 50%"
  },
  "kereste-sevkiyat": {
    "source": "public/assets/catalog/kereste-sevkiyat.jpg",
    "width": 1600,
    "height": 900,
    "alt": "Sevkiyat için araca yüklenmiş kereste istifi",
    "position": "50% 50%",
    "cardPosition": "50% 50%"
  },
  "ahsap-kalip-kirisi-istifi": {
    "source": "public/assets/catalog/ahsap-kalip-kirisi-istifi.jpg",
    "width": 960,
    "height": 1280,
    "alt": "Depoda istiflenmiş sarı gövdeli kırmızı uçlu ahşap kalıp kirişleri",
    "position": "50% 50%",
    "cardPosition": "60% 46%"
  },
  "kalip-kirisi-uygulama": {
    "source": "public/assets/catalog/kalip-kirisi-uygulama.jpg",
    "width": 1600,
    "height": 1200,
    "alt": "Şantiyede perde kalıbında kullanılan ahşap kalıp kirişleri",
    "position": "50% 50%",
    "cardPosition": "50% 50%"
  },
  "ahsap-urun-deposu": {
    "source": "public/assets/catalog/ahsap-urun-deposu.jpg",
    "width": 1600,
    "height": 1200,
    "alt": "Ahşap levha ve kereste paketlerinin bulunduğu ürün deposu",
    "position": "50% 50%",
    "cardPosition": "50% 50%"
  }
};

export function photoWidths(name) {
 const photo = productMedia[name];
 if (!photo) throw new Error('Unknown product photo: ' + name);
 return [...new Set([480, 960, Math.min(1440, photo.width)])].filter(width => width <= photo.width).sort((a, b) => a - b);
}

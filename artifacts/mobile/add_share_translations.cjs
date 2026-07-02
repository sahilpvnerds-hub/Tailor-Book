const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'locales');

const enShare = {
  "orderHeader": "🧵 TAILOR ORDER DETAILS",
  "order": "📋 Order",
  "customer": "👤 Customer",
  "mobile": "📞 Mobile",
  "delivery": "🚚 Delivery",
  "items": "🛍️ ITEMS",
  "product": "Product",
  "qty": "Qty",
  "for": "For",
  "measurements": "Measurements",
  "notes": "📝 Notes",
  "invoiceHeader": "TAILOR BOOK - INVOICE",
  "invoiceNo": "Invoice #",
  "orderNo": "Order #",
  "date": "Date",
  "customerDetails": "CUSTOMER DETAILS",
  "orderItems": "ORDER ITEMS",
  "person": "Person",
  "qtyRate": "Qty/Rate",
  "subtotal": "Subtotal",
  "total": "Total",
  "paid": "Paid",
  "balance": "Balance",
  "status": "Status",
  "footer": "Thank you for choosing us!"
};

const hiShare = {
  "orderHeader": "🧵 टेलर ऑर्डर विवरण",
  "order": "📋 ऑर्डर",
  "customer": "👤 ग्राहक",
  "mobile": "📞 मोबाइल",
  "delivery": "🚚 डिलीवरी",
  "items": "🛍️ आइटम",
  "product": "उत्पाद",
  "qty": "मात्रा",
  "for": "के लिए",
  "measurements": "माप",
  "notes": "📝 नोट्स",
  "invoiceHeader": "टेलर बुक - इनवॉइस",
  "invoiceNo": "इनवॉइस #",
  "orderNo": "ऑर्डर #",
  "date": "दिनांक",
  "customerDetails": "ग्राहक विवरण",
  "orderItems": "ऑर्डर आइटम",
  "person": "व्यक्ति",
  "qtyRate": "मात्रा/दर",
  "subtotal": "उप-कुल",
  "total": "कुल",
  "paid": "भुगतान किया",
  "balance": "बकाया",
  "status": "स्थिति",
  "footer": "हमें चुनने के लिए धन्यवाद!"
};

const guShare = {
  "orderHeader": "🧵 ટેલર ઓર્ડર વિગતો",
  "order": "📋 ઓર્ડર",
  "customer": "👤 ગ્રાહક",
  "mobile": "📞 મોબાઈલ",
  "delivery": "🚚 ડિલિવરી",
  "items": "🛍️ આઇટમ્સ",
  "product": "પ્રોડક્ટ",
  "qty": "માત્રા",
  "for": "માટે",
  "measurements": "માપ",
  "notes": "📝 નોંધો",
  "invoiceHeader": "ટેલર બુક - ઇનવોઇસ",
  "invoiceNo": "ઇનવોઇસ #",
  "orderNo": "ઓર્ડર #",
  "date": "તારીખ",
  "customerDetails": "ગ્રાહક વિગતો",
  "orderItems": "ઓર્ડર આઇટમ્સ",
  "person": "વ્યક્તિ",
  "qtyRate": "માત્રા/ભાવ",
  "subtotal": "પેટા-કુલ",
  "total": "કુલ",
  "paid": "ચૂકવેલ",
  "balance": "બાકી",
  "status": "સ્થિતિ",
  "footer": "અમને પસંદ કરવા બદલ આભાર!"
};

function updateLocale(filename, shareData) {
  const filePath = path.join(localesDir, filename);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data.share = shareData;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Updated ${filename}`);
}

updateLocale('en.json', enShare);
updateLocale('hi.json', hiShare);
updateLocale('gu.json', guShare);

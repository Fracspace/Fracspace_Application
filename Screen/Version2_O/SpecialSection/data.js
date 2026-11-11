// Mock data for the Special Section until the APIs are wired. Copy and images
// come from the design artifact (Hub.dc.html).

export const images = {
  hero: require('./assets/hub-hero.jpg'),
  hilltop: require('./assets/stay-hilltop.jpg'),
  concert: require('./assets/concert-harish.jpg'),
  balcony: require('./assets/stay-balcony.jpg'),
  luxury: require('./assets/stay-luxury.jpg'),
  shivaKit: require('./assets/iva-shiva-kit.jpg'),
  ritualsKit: require('./assets/iva-rituals-kit.jpg'),
  blessedKit: require('./assets/iva-blessed-kit.jpg'),
  yatraKit: require('./assets/iva-yatra-kit.jpg'),
};

// `to` is the Special Section route the slide's CTA opens ('categories' scrolls).
export const heroSlides = [
  {
    eyebrow: 'EXCLUSIVE EXPERIENCES',
    title: 'Welcome to the\nSpecial Section',
    sub: 'Unique stays, premium essentials, iconic concerts & more - all in one place.',
    img: images.hero,
    to: 'categories',
    cta: 'Explore now',
  },
  {
    eyebrow: 'CURATED ESCAPES',
    title: 'Featured\nStays',
    sub: 'Cinematic sanctuaries & architectural retreats',
    img: images.hilltop,
    to: 'Stays',
    cta: 'Browse stays',
  },
  {
    eyebrow: 'SACRED LIVING',
    title: 'Iva\nEssentials',
    sub: 'Ancient Rituals. Curated For Modern Devotion.',
    product: true,
    to: 'IvaShop',
    cta: 'Shop Iva',
  },
  {
    eyebrow: 'LIVE IN HYDERABAD',
    title: 'Harish Sagane\nLive',
    sub: 'Religious India · 14 Nov 2026, Tavaro Resorts',
    img: images.concert,
    to: 'ConcertDetails',
    cta: 'Book tickets',
  },
];

export const stays = [
  {id: 'ds', name: 'Dreamscape', sub: 'Boutique Hotel', price: '₹4,999', rate: '4.8', loc: 'Banjara Hills', img: images.balcony},
  {id: 'ou', name: 'Dreamscape OU Colony', sub: 'Boutique Hotel', price: '₹4,500', rate: '4.5', loc: 'Manikonda', img: images.luxury},
  {id: 'ht', name: 'Hilltop by Fracspace', sub: 'Munnar, Kerala', price: '₹5,999', rate: '4.9', loc: 'Munnar', img: images.hilltop},
];

export const ivaProducts = [
  {id: 'blessed', cat: 'Signature puja kit', name: 'Blessed Kit', price: 1499, img: images.blessedKit},
  {id: 'rudra', cat: 'Rudraksha', name: 'Rudraksha Band', price: 499, img: null},
  {id: 'yatra', cat: 'Blessed & Yatra Kits', name: 'Yatra Kit', price: 199, img: images.yatraKit},
];

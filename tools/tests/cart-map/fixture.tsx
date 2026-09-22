import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Route } from '../../../src/routes/cart';
import { cart } from '../../../src/lib/cart';
import { saveCustomerDeliveryAddresses } from '../../../src/lib/deliveryAddressBook';
import { state } from './backend';
import '../../../src/index.css';
const add = () => cart.add({ itemId: 'item-a', shopId: 'shop-a', name: 'Test Bun', price: 25, imageUrl: null });
add();
if (new URLSearchParams(location.search).has('saved')) {
  saveCustomerDeliveryAddresses('test-customer', [{ id: 'home', kind: 'saved', label: 'บ้าน', recipientName: 'Test Customer', recipientPhone: '0800000000', premises: '1', locality: 'Bangkok', riderNote: '', placeId: null, placeDisplayName: null, formattedAddress: null, deliveryPinLat: 13.78, deliveryPinLng: 100.68, locationSource: 'map_pin', submittedMapUrl: null, locationAccuracyM: null, isDefault: true, usageCount: 1, lastUsedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
}
(window as any).testState = state;
function App() {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const leave = () => setVisible(false); window.addEventListener('test-leave', leave); return () => window.removeEventListener('test-leave', leave); }, []);
  const Checkout = (Route as any).component;
  return <><button id="leave" onClick={() => setVisible(false)}>Leave route</button><button id="enter" onClick={() => { if (!cart.getState().items.length) add(); setVisible(true); }}>Enter cart</button><button id="clear" onClick={() => cart.clear()}>Empty cart</button>{visible && <Checkout />}</>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

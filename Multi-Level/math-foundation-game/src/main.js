import { mountApp } from './ui/app.js';
import { initDeck } from './ui/deck.js';
import { loadState } from './state/store.js';

initDeck().then(() => mountApp(document.getElementById('app'), loadState()));

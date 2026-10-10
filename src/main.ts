// Точка входа. Интеграция режимов собирается после лейнов A/B/C.
import route from 'virtual:content';

document.querySelector('#app')!.textContent = `${route.title}: ${route.stops.length} остановок`;

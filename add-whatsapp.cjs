const fs=require('fs');
let html=fs.readFileSync('dist/index.html','utf8');
if(html.includes('class="floating-whatsapp"'))throw Error('WhatsApp button already exists');
const message='Olá! Gostaria de informações sobre os cursos e as formas de pagamento da ID Idiomas.';
const button=`<a class="floating-whatsapp" href="https://wa.me/5571983627000?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer" aria-label="Conversar com a ID Idiomas sobre cursos e pagamentos no WhatsApp (abre em nova aba)"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12.04 2a9.8 9.8 0 0 0-8.5 14.68L2 22l5.47-1.43A9.83 9.83 0 1 0 12.04 2Zm0 17.83a8 8 0 0 1-4.08-1.12l-.29-.17-3.24.85.86-3.15-.19-.3a8 8 0 1 1 6.94 3.89Zm4.41-5.99c-.24-.12-1.43-.71-1.65-.79-.22-.08-.38-.12-.54.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.46-.39-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.09 3.62.57.25 1.01.4 1.36.51.57.18 1.08.15 1.49.09.45-.07 1.43-.59 1.63-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z"/></svg><span><strong>Fale com a ID</strong><small>Cursos e pagamentos</small></span><span class="whatsapp-arrow" aria-hidden="true">↗</span></a>`;
html=html.replace('</main>',button+'</main>');
html=html.replace('href="contrast.css?v=5"','href="contrast.css?v=6"');
fs.writeFileSync('dist/index.html',html);
console.log('Floating WhatsApp button added to home only.');

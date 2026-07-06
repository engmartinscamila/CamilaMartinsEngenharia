const header=document.querySelector('.site-header');
const menuToggle=document.querySelector('.menu-toggle');
const navLinks=document.querySelector('.nav-links');
function updateHeader(){if(header) header.classList.toggle('scrolled',window.scrollY>24)}
window.addEventListener('scroll',updateHeader);updateHeader();
if(menuToggle&&navLinks){menuToggle.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open));document.body.classList.toggle('no-scroll',open)});document.querySelectorAll('.nav-links a').forEach(link=>link.addEventListener('click',()=>{navLinks.classList.remove('open');menuToggle.setAttribute('aria-expanded','false');document.body.classList.remove('no-scroll')}));}
const observer=new IntersectionObserver((entries)=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}})},{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
document.addEventListener('contextmenu',event=>{if(event.target.closest('.portfolio-viewer')) event.preventDefault()});

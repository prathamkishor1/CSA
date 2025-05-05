// Example: Quotes Carousel
let index = 0;
const quotes = document.querySelectorAll(".carousel p");

setInterval(() => {
  quotes.forEach((quote, i) => {
    quote.style.display = i === index ? "block" : "none";
  });
  index = (index + 1) % quotes.length;
}, 3000);

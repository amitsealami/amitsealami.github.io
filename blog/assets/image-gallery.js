let slideIndex = 1;
showSlides(slideIndex);

// Next/previous controls
function plusSlides(n) {
  showSlides(slideIndex += n);
}

// Thumbnail image controls
function currentSlide(n) {
  showSlides(slideIndex = n);
}

function showSlides(n) {
  let i;
  let slides = document.getElementsByClassName("imgMySlides");
  let dots = document.getElementsByClassName("imgDemo");
  let captionText = document.getElementById("imgCaption");
  if (n > slides.length) {slideIndex = 1}
  if (n < 1) {slideIndex = slides.length}
  for (i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }
  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" imgActive", "");
  }
  slides[slideIndex-1].style.display = "block";
  dots[slideIndex-1].className += " imgActive";
  captionText.innerHTML = dots[slideIndex-1].alt;
}
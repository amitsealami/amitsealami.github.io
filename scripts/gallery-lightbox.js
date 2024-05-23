$(document).ready(function() {
    $('.thumbnail').click(function() {
        var imageSrc = $(this).data('image');
        var caption = $(this).find('.caption').text();
        var lightbox = $('<div class="lightbox"><img src="' + imageSrc + '"><div class="caption">' + caption + '</div></div>');
        $('body').append(lightbox);
        lightbox.click(function() {
            $(this).remove();
        });
    });
});
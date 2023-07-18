function backToTop() {
    window.scrollTo(0, 0);
}

let fontSize = -1;
let element = null;

function initFontSize() {
    fontSize = 16;
    element = document.querySelector(".article");
    element.style.fontSize = `${fontSize}px`;
}

function updateFontSize() {
    element.style.fontSize = `${fontSize}px`;
}

function increaseFontSize() {
    if (fontSize == -1) {
        initFontSize();
    }
    fontSize++;
    updateFontSize();
}

function decreaseFontSize() {
    if (fontSize == -1) {
        initFontSize();
    }
    fontSize--;
    if (fontSize <= 3) {
        fontSize = 3;
    }
    updateFontSize();
}

function printArticle() {
    window.print();
}

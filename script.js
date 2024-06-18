function toggleDropdown() {
    const dropdown = document.querySelector('.dropdown-content');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function navigateTo(url) {
    window.location.href = url;
}

function filterCategory(category) {
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        if (category === 'all' || card.getAttribute('data-category') === category) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });

    document.querySelectorAll('.nav-bar button').forEach(button => {
        button.classList.remove('selected');
    });

    document.querySelector(`.nav-bar button[onclick="filterCategory('${category}')"]`).classList.add('selected');
}

window.onload = function() {
    fetch('markers.json')
        .then(response => response.json())
        .then(data => {
            generateCards(data);
        })
        .catch(error => console.error('Error cargando el archivo JSON:', error));
};

function generateCards(places) {
    const container = document.getElementById('cards-container');
    container.innerHTML = '';
    places.forEach(place => {
        const localImageUrl = place.localImageUrl ? place.localImageUrl.replace(/^.*[\\\/]/, 'img/') : '';

        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-category', place.category);

        card.innerHTML = `
            ${localImageUrl ? `<img src="${localImageUrl}" alt="${place.name}">` : ''}
            <h3>${place.name}</h3>
            <p>${place.description}</p>
            <a href="${place.directionsUrl}" target="_blank">Cómo llegar</a>
        `;

        container.appendChild(card);
    });
}

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

(async () => {
  const url = 'https://www.google.com/maps/d/u/0/edit?mid=1xeqEo238QSn8BCdHCgaguSRJffzCVAY&usp=sharing';

  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  try {
    console.log('Navigating to URL...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

    console.log('Waiting for cookies dialog...');
    const cookiesButton = await page.$('button.VfPpkd-LgbsSe[aria-label="Aceptar todo"]');
    if (cookiesButton) {
      await cookiesButton.click();
      console.log('Accepted cookies');
    } else {
      console.log('No cookies dialog found');
    }

    console.log('Waiting for the list of places to load...');
    await page.waitForSelector('.HzV7m-pbTTYe-ibnC6b', { timeout: 90000 });
    console.log('List of places loaded');

    const results = [];

    // Crear la carpeta 'img' si no existe
    const imgDir = path.join(__dirname, 'img');
    if (!fs.existsSync(imgDir)) {
      fs.mkdirSync(imgDir);
      console.log('Created img directory');
    }

    // Obtener la lista de marcadores
    const markers = await page.$$(`.HzV7m-pbTTYe-ibnC6b`);

    for (let i = 0; i < markers.length; i++) {
      try {
        console.log(`Clicking on place ${i + 1}...`);
        await markers[i].click();
        await customDelay(1000); // Espera personalizada de 1 segundo

        console.log('Waiting for description to load...');
        await page.waitForSelector('.qqvbed-UmHwN', { timeout: 90000 });
        console.log('Description loaded');

        const data = await page.evaluate(() => {
          const infoContainer = document.querySelector('.qqvbed-UmHwN');
          const name = infoContainer.querySelector('.qqvbed-p83tee-lTBxed').innerText || '';
          const descriptionElements = infoContainer.querySelectorAll('.qqvbed-p83tee-lTBxed');
          let description = descriptionElements.length > 1 ? descriptionElements[1].innerText : '';

          // Extract category
          let category = '';
          const categoryMatch = description.match(/\((.*?)\)/);
          if (categoryMatch) {
            category = categoryMatch[1];
            description = description.replace(categoryMatch[0], '').trim();
          }

          const imageUrlElement = document.querySelector('.qqvbed-tJHJj-HiaYvf');
          const rawImageUrl = imageUrlElement ? imageUrlElement.style.backgroundImage.replace(/url\((['"])?(.*?)\1\)/gi, '$2').split(',')[0] : '';

          return {
            name,
            description,
            category,
            imageUrl: rawImageUrl
          };
        });

        console.log('Extracted data:', data);

        // Obtener la URL de cómo llegar
        const directionsButton = await page.$('.U26fgb.mUbCce.p9Nwte.HzV7m-tJHJj-LgbsSe.qqvbed-T3iPGc-LgbsSe');
        if (directionsButton) {
          const [newPage] = await Promise.all([
            new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
            directionsButton.click()
          ]);

          await newPage.bringToFront();
          await newPage.waitForNavigation({ waitUntil: 'networkidle2' });

          try {
            await newPage.waitForSelector('button.VfPpkd-LgbsSe[aria-label="Aceptar todo"]', { timeout: 5000 });
            const newPageCookiesButton = await newPage.$('button.VfPpkd-LgbsSe[aria-label="Aceptar todo"]');
            if (newPageCookiesButton) {
              await newPageCookiesButton.click();
              console.log('Accepted cookies in new page');
            }
          } catch (e) {
            console.log('No cookies dialog in new page');
          }

          await customDelay(5000); // Espera 5 segundos para asegurarse de que la nueva página se cargue

          data.directionsUrl = await newPage.evaluate(() => document.location.href); // Obtener la URL de la nueva pestaña
          await newPage.close(); // Cerrar la nueva pestaña

        } else {
          data.directionsUrl = null;
        }

        results.push(data);

        // Descargar la imagen localmente
        if (data.imageUrl) {
          const imageUrl = data.imageUrl;
          const imageName = `image_${i + 1}.jpg`; // Cambia la extensión según el formato de la imagen
          const imagePath = path.join(imgDir, imageName);

          await downloadImage(imageUrl, imagePath);
          await customDelay(2000); // Espera 2 segundos después de la descarga

          data.localImageUrl = imagePath; // Agregar la ruta local de la imagen al objeto de datos
        }

        // Cerrar la ventana de información y volver a la lista de lugares
        console.log('Closing place information...');
        await page.click('.Ce1Y1c .HzV7m-tJHJj-LgbsSe-Bz112c.qqvbed-a4fUwd-LgbsSe-Bz112c');
        await customDelay(1000); // Espera personalizada de 1 segundo
        console.log('Place information closed.');

      } catch (innerError) {
        console.error('Error extracting information:', innerError);
      }
    }

    console.log('Results:', results);

    // Guardar los resultados en un archivo JSON
    try {
      fs.writeFileSync('markers.json', JSON.stringify(results, null, 2));
      console.log('Results saved to markers.json');
    } catch (writeError) {
      console.error('Error writing to markers.json:', writeError);
    }
  } catch (error) {
    console.error('Error extracting information:', error);
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
})();

async function customDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadImage(url, imagePath) {
  const file = fs.createWriteStream(imagePath);

  return new Promise((resolve, reject) => {
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve());
      });
    }).on('error', err => {
      fs.unlink(imagePath, () => reject(err)); // Eliminar el archivo si ocurre un error
    });
  });
}

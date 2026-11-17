import '../styles.css'
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div class = "top-bar">
  <div>
    <button onclick = "document.getElementById('modal-add-product').showModal()">Ajouter un produit </button>
    <button id = "btn-open-stock">Modifier le stock </button>
    <button id = "btn-open-lieu"> Ajouter un lieu </button>
  </div>

  <input type="text" id="txt-search" placeholder="Rechercher un produit...">
  </div>

    <dialog id = "modal-add-product">
    <h2> Ajouter un produit</h2>
    <input type = "text" id = "txt-product" placeholder ="Produit">
    <input type = "number" id = "txt-quantite" placeholder = "Quantité" min = "0" step = "1">
    <select id = "select-lieu">
      <option value = ""> Choisir un lieu </option>
    </select>
    <input type = "file" id = "img-product" accept= "image/*">
    <img id="img-preview" alt="Aperçu" style = "display : none; width: 100px; height: 100px; object-fit: cover" >
    <button id = "btn-add-produit"> Ajouter </button>
    <button onclick="document.getElementById('modal-add-product').close()">Fermer </button>
    </dialog>

    <dialog id = "modal-stock">
    <h2> Ajouter du stock </h2>
    <select id = "select-stock">
      <option value = ""> Choisir un produit </option>
    </select>
    <p id = "stock-actuel"> </p>
    <input type = "number" id = "txt-ajout-stock" placeholder = "Quantité à ajouter" min = "1" step = "1">
    <button id = "btn-valider-stock"> Valider </button>
    <button onclick = "document.getElementById('modal-stock').close()"> Fermer </button>
    </dialog>

    <dialog id = "modal-lieu">
    <h2> Ajouter un lieu </h2>
    <input type = "text" id = "txt-lieu" placeholder = "Lieu">
    <button id = "btn-add-lieu"> Ajouter </button>
    <button onclick = "document.getElementById('modal-lieu').close()">Fermer </button>
    </dialog>

  <ul class = "listProduct" id = "productlist"></ul>
`
const max_size = 2 * 1024 * 1024;
const URL_API = "http://localhost:3000";
let allProducts: any[] = [];

// ------------------------------------------------------------------
// Permet de vider la liste et de réafficher les produits rechercher
// ------------------------------------------------------------------

function renderProducts(products: any[]) {
  const ul = document.querySelector<HTMLElement>('#productlist');
  if (ul) {
    ul.innerHTML = '';
    for (const p of products) {
      displayProduct(p);
    }
  }
}

// ----------------------------------------------------------------
// Fonction qui permet d'avoir la preview de l'image selectionnée.
// ----------------------------------------------------------------

function previewProductImage() {
  const inputimg = document.querySelector<HTMLInputElement>('#img-product');
  const previewimg = document.querySelector<HTMLInputElement>('#img-preview');

  if (!inputimg) {
    console.error("Il n'y a pas d'image de sélectioné");
    return;
  }

  if (!previewimg) {
    console.error("Il n'y a pas d'aperçu");
    return;
  }

  let imgurl: string | null = null;

  inputimg.addEventListener("change", () => {
    const file = inputimg.files?.[0];

    if (!file) {
      previewimg.style.display = 'none';
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert("Le fichier doit être une image");
      inputimg.value = '';
      previewimg.style.display = 'none';
      return;
    }

    if (file.size > max_size) {
      alert("Image trop lourde, 2Mo max");
      inputimg.value = '';
      previewimg.style.display = 'none';
      return;
    }

    if (imgurl) {
      URL.revokeObjectURL(imgurl);
    }

    imgurl = URL.createObjectURL(file);
    previewimg.src = imgurl;
    previewimg.style.display = 'block';
  })
}


// -----------------------------------------
// Envoie de l'ajout des produit au serveur 
// -----------------------------------------

async function ajouterStock() {
  const select = document.querySelector<HTMLSelectElement>("#select-stock");
  const txtAjout = document.querySelector<HTMLInputElement>("#txt-ajout-stock");
  if (!select || !txtAjout) {
    return;
  }

  const option = select.selectedOptions[0];
  if (!option || !option.value) {
    alert("Choisissez un produit");
    return;
  }

  const reponse = await fetch(`${URL_API}/stocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_produit: option.value, id_lieu: option.dataset.lieu, quantite: txtAjout.value })
  })

  if (reponse.ok) {
    txtAjout.value = "";
    document.querySelector<HTMLDialogElement>("#modal-stock")?.close();
    initProductList();
    fetchProduct();
  }
  else {
    const err = await reponse.json();
    alert(err.error);
  }
}

// -------------------------------------------------------------
// Fonction qui permet d'ajouter des lieux à la liste des lieux.
// -------------------------------------------------------------

async function ajouterLieu() {
  const txtAjoutLieu = document.querySelector<HTMLInputElement>('#txt-lieu');
  if (!txtAjoutLieu) {
    return;
  }
  const nomLieu = txtAjoutLieu.value.trim();
  if (!nomLieu) {
    alert('Veuillez entrer le nom du lieu');
    return;
  }

  const reponse = await fetch(`${URL_API}/lieux`, {
    method: "POST",
    headers: { "Content-type": "application/json" },
    body: JSON.stringify({ nom: nomLieu })
  });
  if (reponse.ok) {
    txtAjoutLieu.value = "";
    document.querySelector<HTMLDialogElement>("#modal-lieu")?.close();

    await chargerLieu();
  }
  else {
    const err = await reponse.json();
    alert(err.error);
  }

}

// ------------------------------------------------------
// Fonction qui permet d'initialiser la liste de produit.
// ------------------------------------------------------

function initProductList() {
  const ul = document.querySelector<HTMLUListElement>('#productlist');
  if (ul) {
    ul.innerHTML = '';
  }
}

// -------------------------------------------
// Fonction qui initialise le bouton de modif
// -------------------------------------------

function initStockButton() {
  const btnOpen = document.querySelector<HTMLButtonElement>("#btn-open-stock");
  const btnValider = document.querySelector<HTMLButtonElement>("#btn-valider-stock");
  const select = document.querySelector<HTMLSelectElement>("#select-stock");
  const modal = document.querySelector<HTMLDialogElement>("#modal-stock");
  if (!btnOpen || !btnValider || !select || !modal) {
    return;
  }
  btnOpen?.addEventListener("click", async () => {
    await LoadStock();
    afficherStockActuel();
    modal.showModal();
  });

  select.addEventListener("change", afficherStockActuel);
  btnValider.addEventListener("click", ajouterStock);

  modal.addEventListener("close", resetStockForm);
}

// ---------------------------------------------------------
// Fonction qui initialise le bouton pour ajouter des lieux
// ---------------------------------------------------------

function initLieuButton() {
  const btnOpenLieu = document.querySelector<HTMLButtonElement>("#btn-open-lieu");
  const btnValider = document.querySelector<HTMLButtonElement>("#btn-add-lieu");
  const modal = document.querySelector<HTMLDialogElement>("#modal-lieu");

  if (!btnOpenLieu || !btnValider || !modal) {
    return;
  }

  btnOpenLieu.addEventListener("click", () => {
    modal.showModal();
  });

  btnValider.addEventListener("click", ajouterLieu);

  modal.addEventListener("close", resetLieuForm)
}

// -------------------------------
// Ajoute les produits à la liste
// -------------------------------

async function addProduct() {
  const txtProduct = document.querySelector<HTMLInputElement>('#txt-product');
  const txtQuantite = document.querySelector<HTMLInputElement>('#txt-quantite');
  const selectLieu = document.querySelector<HTMLSelectElement>('#select-lieu');
  const inputImg = document.querySelector<HTMLInputElement>('#img-product');
  const previewImg = document.querySelector<HTMLImageElement>('#img-preview');

  if (!inputImg || !txtProduct || !previewImg || !txtQuantite || !selectLieu) {
    return;
  }

  const file = inputImg.files?.[0];

  // FormData permet d'envoyer le nom et le fichier en une seul requête
  const formData = new FormData();
  formData.append('name', txtProduct.value); // On envoie le nom
  formData.append('quantite', txtQuantite.value); // On envoie la quantité
  formData.append('id_lieu', selectLieu.value); // On venvoie le lieu
  if (file) {
    formData.append("image", file); // On envoie l'image si file n'est pas vide
  }

  const reponse = await fetch(`${URL_API}/produits`, {
    method: "POST",
    body: formData
  });

  if (reponse.ok) {
    const produit = await reponse.json();
    // On va chercher sur l'interface ce que l'utilisateur à selectionné
    produit.lieu = selectLieu.selectedOptions[0].textContent;
    displayProduct(produit);

    txtProduct.value = "";
    txtQuantite.value = "";
    selectLieu.value = "";
    inputImg.value = "";
    previewImg.style.display = "none";
    document.querySelector<HTMLDialogElement>("#modal-add-product")?.close();
  }

  else {
    const err = await reponse.json();
    alert(err.error);
  }
}

// -------------------------------------------------
// Rempli la liste des produits du pop up du stock.
// -------------------------------------------------
async function LoadStock() {
  const select = document.querySelector<HTMLSelectElement>("#select-stock");
  if (!select) {
    return;
  }

  const reponse = await fetch(`${URL_API}/produits`);
  if (!reponse.ok) {
    return;
  }
  const produits = await reponse.json();

  // On repart d'une liste vide pour éviter les doublons 
  select.innerHTML = '<option value = ""> Choisir un produit </option>';

  for (const p of produits) {
    // un produits sans quantité, on l'ignore
    if (p.quantite === null) {
      continue;
    }

    const option = document.createElement("option");
    option.value = p.id_produit;
    option.textContent = `${p.nom} (${p.lieu})`;
    // On garde les infos utiles sur option
    option.dataset.lieu = p.id_lieu;
    option.dataset.quantite = p.quantite;
    select.appendChild(option);
  }
}

// -----------------------------------------
// Afficher la quantité de produit en stock.
// -----------------------------------------
function afficherStockActuel() {
  const select = document.querySelector<HTMLSelectElement>("#select-stock");
  const texte = document.querySelector<HTMLElement>("#stock-actuel");
  if (!select || !texte) {
    return;
  }

  const option = select.selectedOptions[0];
  texte.textContent = option && option.value ? `Stock actuel : ${option.dataset.quantite}` : "";
}

// ----------------------------------------------
// Fonction qui permet l'affichage des produits.
// ----------------------------------------------

function displayProduct(produit: { nom: string, image: string | null, quantite: number | null, lieu: string | null }) {
  const ul = document.querySelector<HTMLElement>("#productlist");
  if (!ul) {
    return;
  }

  const li = document.createElement("li");

  if (produit.image) {
    const img = document.createElement("img");
    img.src = `${URL_API}/uploads/${produit.image}`;
    img.alt = produit.nom;
    li.appendChild(img);
  }

  // On affiche le nom à coté de l'image
  const nom = document.createElement("div");
  nom.textContent = `${produit.nom}`;
  li.appendChild(nom);

  if (produit.quantite !== null && produit.lieu) {
    const quantite = document.createElement("div");
    quantite.textContent = `Quantité : ${produit.quantite}`;
    li.appendChild(quantite);

    const lieu = document.createElement("div");
    lieu.textContent = `Lieu : ${produit.lieu}`;
    li.appendChild(lieu);

    ul.appendChild(li);
  }
}


// -----------------------------------------
// Fonction qui permet de GET les produits.
// -----------------------------------------

async function fetchProduct() {
  const reponse = await fetch(`http://localhost:3000/produits`, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  })
  if (reponse.ok) {
    allProducts = await reponse.json(); // On stock tous les produits
    renderProducts(allProducts); // On les affiche proprement
  }
}


// ---------------------------------------------------------------------
// Fonction qui remplis la liste des lieux à partir de la base de donnée 
// ---------------------------------------------------------------------

async function chargerLieu() {
  const select = document.querySelector<HTMLSelectElement>("#select-lieu");
  if (!select) {
    return;
  }

  const reponse = await fetch(`${URL_API}/lieux`);
  if (!reponse) {
    return;
  }

  const lieux = await reponse.json();

  //Reset du select pour éviter les doublons
  select.innerHTML = '<option value = ""> Choisir un lieu </option>';

  for (const l of lieux) {
    const option = document.createElement("option");
    option.value = l.id_lieu // Ca c'est ce que le serveur voit
    option.textContent = l.nom // Ca c'est ce que l'utilisateur voit
    select.appendChild(option);
  }
}

function initAddButton() {
  const btnAdd = document.querySelector<HTMLInputElement>('#btn-add-produit');
  if (btnAdd) {
    btnAdd.addEventListener("click", () => {
      addProduct();
    })
  }
}

function initSearch() {
  const searchInput = document.querySelector<HTMLInputElement>("#txt-search");
  if (!searchInput) {
    return;
  }

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();

    const filtredProduct = allProducts.filter(p => p.nom.toLowerCase().includes(query));
    renderProducts(filtredProduct);
  })
}

// ---------------------------------------------
// Fonction pour reset les pop up à la fermeture
// ---------------------------------------------

function resetAddProductForm(){
  const txtProduct = document.querySelector<HTMLInputElement>('#txt-product');
  const txtQuantite = document.querySelector<HTMLInputElement>('#txt-quantite');
  const selectLieu = document.querySelector<HTMLSelectElement>('#select-lieu');
  const inputImg = document.querySelector<HTMLInputElement>('#img-product');
  const previewImg = document.querySelector<HTMLImageElement>('#img-preview');

  if(txtProduct){
    txtProduct.value = "";
  }
  if (txtQuantite){
    txtQuantite.value = "";
  }
  if (selectLieu){
    selectLieu.value = "";
  }
  if (inputImg){
    inputImg.value = "";
  }
  if (previewImg){
    previewImg.src = "";
    previewImg.style.display = "none";
  }
}

function resetStockForm(){
  const selectStock = document.querySelector<HTMLSelectElement>('#select-stock');
  const txtAjouterStock = document.querySelector<HTMLInputElement>('#txt-ajout-stock');
  const stockActuel = document.querySelector<HTMLElement>('#stock-actuel');

  if (selectStock){
    selectStock.value = "";
  }
  if (txtAjouterStock){
    txtAjouterStock.value = "";
  }
  if (stockActuel){
    stockActuel.textContent = "";
  }
}

function resetLieuForm(){
  const txtLieu = document.querySelector<HTMLInputElement>('#txt-lieu');
  if (txtLieu){
    txtLieu.value = "";
  }
}

// Appel de la fonction qui permet de reset les champs lors de la fermeture du pop up d'ajout de produit
const modalAddProduct = document.querySelector<HTMLDialogElement>('#modal-add-product');
if(modalAddProduct){
  modalAddProduct.addEventListener("close", resetAddProductForm)
}

initProductList();
fetchProduct();
previewProductImage();
chargerLieu();
initAddButton();
initStockButton();
initLieuButton();
initSearch()
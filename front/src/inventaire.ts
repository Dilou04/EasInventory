import '../styles.css'

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="top-bar">
    <a href="/index.html"><button>Retour à l'accueil</button></a>
    <button id = "new-inventory">Nouvel inventaire</button>
    <input type = "text" id = "txt-search" placeholder = "Recherche de produit ...">
  </div>

  <select id = "select-lieu-filter">
    <option value = ""> Tous les lieux </option>
  </select>

  <table class = "inventory-table">
    <thread>
      <tr>
        <th> Nom du produit </th>
        <th> Lieu </th>
        <th> Quantité </th>
      </tr>
    </thread>
  <tbody id = "inventory-body></tbody>
</table>

<dialog id = "modal-inventory">
  <h2> Inventaire </h2>
  <button id = "btn-inventory-add"> Ajouter des produits </button>
  <button id = "btn-inventory-cancel"> Annuler et quitter l'inventaire</button>
  <button onclick = "document.getElementById('modal-inventory').close()> Fermer </button>
</dialog>
`

const URL_API = "http://localhost:3000";
let allProduct : any[] = [];

// ---------------------------------
// Ajout des lignes de l'inventaire 
// ---------------------------------

function creerCellule(texte: string){
  const td = document.createElement("td");
  td.textContent = texte;
  return td;
}

// -------------------------------------------------------------------------------
// Fonction qui permet l'affichage dans le tableau des cellules créer juste avant
// -------------------------------------------------------------------------------

function displayInventory(product : any[]){
  const body = document.querySelector<HTMLElement>('#inventory-body');
  if (!body){
    return;
  }
  body.innerHTML = '';

  if (product.length === 0){
    const tr = document.createElement("tr");
    const td = creerCellule("tr");
    td.colSpan = 3;
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  for (const p of product){
    const tr = document.createElement("tr");

    tr.appendChild(creerCellule(p.nom));
    tr.appendChild(creerCellule(p.lieu ?? "-"));
    tr.appendChild(creerCellule(p.quantite !== null ? String(p.quantite) : "-"));

    body.appendChild(tr);
  }
}

// ----------------------------------------------------------------------------
// Fonction qui applique la recherche et qui filtres selon le lieu selectionné
// ----------------------------------------------------------------------------

function appliquerFiltres(){
  const recherche = document.querySelector<HTMLInputElement>('#txt-search');
  const filtresLieu = document.querySelector<HTMLSelectElement>('#select-lieu-filter');
  if (!recherche || !filtresLieu){
    return;
  }

  const texte = recherche.value.toLowerCase().trim();
  const lieu = filtresLieu.value;

  const resultat = allProduct.filter(p =>
    p.nom.toLowerCase().includes(texte) &&
    (lieu === "" || String(p.id_lieu) === lieu)
  );  
  displayInventory(resultat);
}

// --------------------------------------------------
// Fonction qui récupère les produits sur le serveur 
// --------------------------------------------------

async function fetchInventory(){
  const reponse = await fetch(`${URL_API}/produits`);
  if (!reponse.ok){
    console.error("Impossible de charger les produits");
    return;
  }
  allProduct = await reponse.json();
  appliquerFiltres();
}

// ------------------------------------------------------
// Fonction qui rempli la liste des lieux dans le filtre
// ------------------------------------------------------

async function chargerFiltreLieu(){
  const select = document.querySelector<HTMLSelectElement>('#select-lieu-filter');
  if (!select){
    return;
  }

  const reponse = await fetch(`${URL_API}/lieux`);
  if (!reponse.ok){
    return;
  }
  const lieux = await reponse.json();

  for (const l of lieux){
    const option = document.createElement("option");
    option.value = l.id_lieu;
    option.textContent = l.nom;
    select.appendChild(option);
  }
}

// ------------------------------------------------
// Fonction qui connecte la recherche et le filtre
// ------------------------------------------------

function initFiltre(){
  document.querySelector<HTMLInputElement>('#txt-search')?.addEventListener("input", appliquerFiltres);
  document.querySelector<HTMLSelectElement>('#select-lieu-filter')?.addEventListener("change", appliquerFiltres);

}

// -------------------------------------------------
// Fonction qui gère le pop up du nouvel inventaire
// -------------------------------------------------

function initInventoryPopUp(){
  const btnNew = document.querySelector<HTMLButtonElement>('#new-inventory');
  const btnAdd = document.querySelector<HTMLButtonElement>('#btn-inventory-add');
  const btnCancel = document.querySelector<HTMLButtonElement>('#btn-inventory-cancel');
  const modal = document.querySelector<HTMLDialogElement>('#modal-inventory');
  if (!btnNew || !btnAdd || !btnCancel || !modal){
    console.error("initInventoryPopup : un élément du pop up ets introuvable");
    return;
  }

  // "Nouvel inventaire" ouvre le pop up
  btnNew.addEventListener("click", () => {
    modal.showModal();
  });

  // Ajout de produit : ouvre un pop up 
  btnAdd.addEventListener("click", () => {
    modal.close();
  });

  // "Annuler" on demande confirmation et on quitte ensuite
  btnCancel.addEventListener("click", () => {
    if (!confirm("Annuler l'inventaire et quitter ?")){
      return;
    }
    modal.close();
    //TODO : quand l'inventaire en cours sera mémorisé , il faudra le vider la 
    window.location.href = "/index.html";
  });
}

initFiltre();
initInventoryPopUp();
chargerFiltreLieu();
fetchInventory();
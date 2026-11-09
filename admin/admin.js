const listings = [
  { title: "Rumours — Vinyl", seller: "Needle Drop Records", status: "Active" },
  { title: "Kind of Blue — CD", seller: "Blue Note Collectibles", status: "Sold" },
  { title: "Purple Rain — Cassette", seller: "Tape Deck Finds", status: "Inactive" },
];

const search = document.querySelector("#search");
const tableBody = document.querySelector("#listings");
const feedback = document.querySelector("#feedback");
const dialog = document.querySelector("#remove-dialog");
const form = document.querySelector("#remove-form");
const listingName = document.querySelector("#listing-name");
const reason = document.querySelector("#reason");

let selectedListing;

function renderListings() {
  const query = search.value.trim().toLowerCase();
  const matches = listings.filter((listing) =>
    [listing.title, listing.seller].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );

  tableBody.replaceChildren();

  if (matches.length === 0) {
    const cell = tableBody.insertRow().insertCell();
    cell.colSpan = 4;
    cell.textContent = "No matching listings.";
    return;
  }

  for (const listing of matches) {
    const row = tableBody.insertRow();
    row.insertCell().textContent = listing.title;
    row.insertCell().textContent = listing.seller;
    row.insertCell().textContent = listing.status;

    const action = row.insertCell();
    if (listing.status === "Inactive") {
      action.textContent = "Already removed";
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Remove listing";
    button.setAttribute("aria-label", `Remove ${listing.title}`);
    button.addEventListener("click", () => {
      selectedListing = listing;
      listingName.textContent = `Remove ${listing.title} from the marketplace?`;
      form.reset();
      reason.setCustomValidity("");
      dialog.showModal();
      reason.focus();
    });
    action.append(button);
  }
}

search.addEventListener("input", renderListings);
document.querySelector("#cancel").addEventListener("click", () => dialog.close());
reason.addEventListener("input", () => reason.setCustomValidity(""));

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const removalReason = reason.value.trim();
  if (!removalReason) {
    reason.setCustomValidity("Enter a reason for removal.");
    reason.reportValidity();
    return;
  }

  selectedListing.status = "Inactive";
  selectedListing.removalReason = removalReason;
  feedback.textContent = `${selectedListing.title} was marked inactive.`;
  dialog.close();
  renderListings();
  search.focus();
});

renderListings();
import Papa from "papaparse";

export interface Flashcard {
  front: string;
  back: string;
}

export function exportToCSV(cards: Flashcard[]) {
  const csv = Papa.unparse(cards);

  // Create blob and download link in browser
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "flashcards.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

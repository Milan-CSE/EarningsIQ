import re
import warnings
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

ITEMS = [
    ("ITEM 1A", "Item 1A. Risk Factors"),
    ("ITEM 1B", "Item 1B. Unresolved Staff Comments"),
    ("ITEM 1",  "Item 1. Business"),
    ("ITEM 7A", "Item 7A. Quantitative and Qualitative Disclosures About Market Risk"),
    ("ITEM 7",  "Item 7. Management's Discussion and Analysis"),
    ("ITEM 8",  "Item 8. Financial Statements and Supplementary Data"),
]

class SECFilingParser:
    def __init__(self, html_content: str):
        self.soup = BeautifulSoup(html_content, "lxml")

    def _is_ixbrl_garbage(self, text: str) -> bool:
        """Filters out non-human machine-readable taxonomy noise."""
        if "http://fasb.org/" in text or "http://www.xbrl.org/" in text:
            return True
        # Ratio of letters to total characters
        letters = len(re.findall(r"[a-zA-Z]", text))
        if len(text) > 200 and (letters / len(text)) < 0.45:
            return True
        return False

    def _is_financial_table(self, table_soup) -> bool:
        """Determines if a table holds numbers/dates vs layout styling."""
        text = table_soup.get_text()
        has_currency = "$" in text
        has_years = bool(re.search(r"\b20\d{2}\b", text))
        has_numbers = len(re.findall(r"\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b", text)) >= 3
        return (has_currency or has_years) and has_numbers

    def _table_to_markdown(self, table_soup) -> str:
        rows = table_soup.find_all("tr")
        table_data = []
        for r in rows:
            cols = [td.get_text(separator=" ", strip=True) for td in r.find_all(["td", "th"])]
            clean_cols = [re.sub(r"\s+", " ", c) for c in cols if c]
            if clean_cols:
                table_data.append(" | ".join(clean_cols))
        return "\n".join(table_data) if len(table_data) > 1 else ""

    def parse(self, meta: dict) -> list[dict]:
        records = []
        current_section = "General / Front Matter"
        elements = self.soup.find_all(["p", "div", "table"])

        for idx, el in enumerate(elements):
            text = el.get_text(separator=" ", strip=True)
            if not text:
                continue

            upper_text = text.upper()
            for key, label in ITEMS:
                if re.match(rf"^\s*{key}\b", upper_text):
                    current_section = label
                    break

            if el.name == "table":
                if self._is_financial_table(el):
                    md_table = self._table_to_markdown(el)
                    if md_table:
                        records.append({
                            "cik": meta["cik"],
                            "company_name": meta["company_name"],
                            "filing_type": meta["filing_type"],
                            "reporting_period": meta["reporting_period"],
                            "section": current_section,
                            "subsection": None,
                            "content_type": "table",
                            "content": md_table,
                            "table_context": "Financial Metrics / Disclosure Table",
                            "source_location": f"{current_section}#elem_{idx}"
                        })
            else:
                if self._is_ixbrl_garbage(text):
                    continue
                # Keep meaningful paragraphs (more than 20 words)
                if len(text.split()) > 20:
                    records.append({
                        "cik": meta["cik"],
                        "company_name": meta["company_name"],
                        "filing_type": meta["filing_type"],
                        "reporting_period": meta["reporting_period"],
                        "section": current_section,
                        "subsection": None,
                        "content_type": "prose",
                        "content": re.sub(r"\s+", " ", text),
                        "table_context": None,
                        "source_location": f"{current_section}#elem_{idx}"
                    })
        return records
import re
import warnings
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

# Filter out SEC inline-XBRL / XML parser warnings
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

    def _table_to_markdown(self, table_soup) -> str:
        """
        Converts an HTML table into a clean markdown table string,
        preserving row-column relationships.
        """
        rows = table_soup.find_all("tr")
        table_data = []
        for r in rows:
            cols = [td.get_text(separator=" ", strip=True) for td in r.find_all(["td", "th"])]
            clean_cols = [c for c in cols if c]
            if clean_cols:
                table_data.append(" | ".join(clean_cols))
        return "\n".join(table_data) if len(table_data) > 1 else ""

    def parse(self, meta: dict) -> list[dict]:
        """
        Walks through the document and generates structured elements
        tagged with complete financial context.
        """
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
                        "table_context": "Financial Statement / Disclosure Table",
                        "source_location": f"{current_section}#elem_{idx}"
                    })
            else:
                # Store prose blocks with substantive content
                if len(text.split()) > 15:
                    records.append({
                        "cik": meta["cik"],
                        "company_name": meta["company_name"],
                        "filing_type": meta["filing_type"],
                        "reporting_period": meta["reporting_period"],
                        "section": current_section,
                        "subsection": None,
                        "content_type": "prose",
                        "content": text,
                        "table_context": None,
                        "source_location": f"{current_section}#elem_{idx}"
                    })
        return records
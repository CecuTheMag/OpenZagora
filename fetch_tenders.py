import json
import urllib.request
import urllib.error
from datetime import datetime

# Configuration
BASE_URL = "https://service.eop.bg/NX1Service.svc/GetPublicBuyerProfileTendersBySpecified"
ORGANIZATION_ID = 21609
BATCH_SIZE = 100  # Fetch 100 at a time
TOTAL_RECORDS = 627

# Headers
HEADERS = {
    "Content-Type": "application/json; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
}

def fetch_tenders():
    """Fetch all tenders from the API"""
    all_tenders = []
    
    for start_idx in range(1, TOTAL_RECORDS + 1, BATCH_SIZE):
        end_idx = min(start_idx + BATCH_SIZE - 1, TOTAL_RECORDS)
        
        payload = {
            "searchParameters": {
                "StartIndex": start_idx,
                "EndIndex": end_idx,
                "PropertyFilters": [],
                "SearchText": None,
                "SearchProperty": None,
                "OrderAscending": False,
                "OrderColumn": "CreatedDate",
                "Keywords": [],
                "UserId": None
            },
            "organizationId": ORGANIZATION_ID
        }
        
        print(f"Fetching tenders {start_idx}-{end_idx}...", end=" ", flush=True)
        
        try:
            req = urllib.request.Request(
                BASE_URL,
                data=json.dumps(payload).encode('utf-8'),
                headers=HEADERS,
                method='POST'
            )
            
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode('utf-8'))
            
            tenders = data.get("CurrentPageResults", [])
            all_tenders.extend(tenders)
            
            print(f"✓ Got {len(tenders)} tenders")
            
        except urllib.error.URLError as e:
            print(f"✗ Network Error: {str(e)}")
            continue
        except Exception as e:
            print(f"✗ Error: {str(e)}")
            continue
    
    return all_tenders

def parse_date(date_str):
    """Convert /Date(timestamp)/ format to readable date"""
    try:
        if date_str and 'Date(' in str(date_str):
            timestamp = int(date_str.split('(')[1].split(')')[0]) / 1000
            return datetime.fromtimestamp(timestamp).isoformat()
    except:
        return date_str
    return date_str

def clean_tenders(tenders):
    """Clean and format tender data"""
    cleaned = []
    for tender in tenders:
        clean_item = {
            "id": tender.get("Id"),
            "tenderId": tender.get("TenderId"),
            "name": tender.get("TenderName"),
            "description": tender.get("TenderDescription"),
            "specialNumber": tender.get("SpecialNumber"),
            "status": tender.get("Status"),
            "createdDate": parse_date(tender.get("CreatedDate")),
            "publishedDate": parse_date(tender.get("PublicationDate")),
            "deadline": parse_date(tender.get("Deadline")),
            "procedureType": tender.get("ProcedureType"),
            "isEUFunding": tender.get("IsEUFunding"),
            "isFrameworkAgreement": tender.get("IsFrameworkAgreement"),
            "isGreenCriteria": tender.get("IsGreenCriteria"),
            "organizationId": tender.get("OrganizationId"),
            "guid": tender.get("Guid")
        }
        cleaned.append(clean_item)
    
    return cleaned

def save_to_json(data, filename="tenders_stara_zagora.json"):
    """Save data to nicely formatted JSON file"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ Saved {len(data)} tenders to {filename}")
    print(f"  File size: {len(json.dumps(data, ensure_ascii=False)) / 1024:.2f} KB")

if __name__ == "__main__":
    print(f"Fetching all {TOTAL_RECORDS} tenders from Stara Zagora...\n")
    
    # Fetch all tenders
    raw_tenders = fetch_tenders()
    
    print(f"\n📊 Retrieved {len(raw_tenders)} tenders total")
    
    # Clean and format
    print("Processing tenders...")
    cleaned_tenders = clean_tenders(raw_tenders)
    
    # Save to JSON
    save_to_json(cleaned_tenders)
    print("\n✅ Done!")

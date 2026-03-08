# TODO: Tender Data Pipeline Implementation

## Task: Implement automated tender fetching for project map

### Steps:
1. [ ] Update data pipeline cron schedule (24 hours for EOP)
2. [ ] Create Python wrapper script to parse fetch_tenders.py output
3. [ ] Add infrastructure filter to include only relevant tenders
4. [ ] Update unified map endpoint with filtering
5. [ ] Test the full pipeline

### Infrastructure Tenders (Keep):
- Construction, renovation, repairs (СМР, строителство, ремонт)
- Energy efficiency (енергийна ефективност)
- Infrastructure (инфраструктура)
- Public buildings (сгради, училища, болници)
- Roads, streets (пътища, улици)
- Parks, green areas (паркове, озеленяване)
- Water, sewage (ВиК, водоснабдяване)
- Public lighting (улично осветление)

### Exclude:
- Food supplies (хранителни продукти)
- Clothing/uniforms (работни облекла)
- Office supplies
- Veterinary services
- Insurance


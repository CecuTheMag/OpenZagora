# EOP Map Data Fix TODO

## Status: In Progress


- Add fallback: if no exact match → `geocodeWithOSM("Стара Загора, България + ${municipality}")`
- Integrate eopDistrictMapper if available

### [ ] 4. Restart server: `cd server && npm run dev`
### [ ] 5. Test pipeline: Map → "Fetch Data" button
### [ ] 6. Verify: `curl http://localhost:5000/api/osm/debug` → osm>0, eop>0
### [ ] 7. Map shows markers ✓

*Estimated time: 5 minutes*

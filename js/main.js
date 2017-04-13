main();

var worldMap;

function main() {
    worldMap = new WorldMap("#world-map", "data/world-50m.json", "data/tectonic_plates.json", "data/natural_disasters.csv");
}

function brushMapClear() {
    return worldMap.brush.clear();
}

function updateHistogram() {
    return worldMap.updateHistogram();
}

function updatePlates(){
    return worldMap.updatePlates();
}
WorldMap = function(_parentElement, _dataMap, _dataPlates, _dataDisasters) {
	this.parentElement = _parentElement;
	this.dataMap = _dataMap;
	this.dataPlates = _dataPlates;
	this.dataDisasters = _dataDisasters;
	this.loadData();
};

WorldMap.prototype.loadData = function() {
	var vis = this;

	vis.initVis();

	// Load CSV file
	queue()
		.defer(d3.json, vis.dataMap)
		.defer(d3.json, vis.dataPlates)
		.defer(d3.csv, vis.dataDisasters)
		.await(function(error, mapTopJson, platesTopJson, disastersCsvData){

			vis.world = topojson.feature(mapTopJson, mapTopJson.objects.countries).features;
			vis.plates = platesTopJson.features;

			disastersCsvData.forEach(function(d){
				d.LATITUDE = +d.LATITUDE;
				d.LONGITUDE = +d.LONGITUDE;
				d.MAGNITUDE = +d.MAGNITUDE;
				d.TIME = vis.formatDate.parse(d.YEAR);
			});

			vis.allData = disastersCsvData;

			// Draw the visualization for the first time
			vis.displayVis();

			d3.select("#map-data").on("change", updateHistogram);
			d3.select("#checkbox-plates").on("change", updatePlates);


		});

};

WorldMap.prototype.initVis = function() {

	this.disasters = ["Earthquake", "Volcano", "Tsunami"];
	this.textDate = d3.time.format("%B %e, %Y");
	//var brush, rangeDates;
	this.value = "";
	this.radiusScale = {};
	this.formatDate = d3.time.format("%Y");
	//var legendData, categories;
	//var allData, data, filteredData, selectedData, world, plates;

	this.createSVG();
	this.setupScale();
	this.setupAxes();
	this.setupProjection();
};

WorldMap.prototype.createSVG = function() {
	var vis = this;

	// Map
	vis.margin = {top: 50, right: 40, bottom: 220, left: 250};
	vis.width = 1200 - vis.margin.left - vis.margin.right;
	vis.height = 800 - vis.margin.top - vis.margin.bottom;

	vis.tip = d3.tip()
		.attr('class', 'd3-tip');

	vis.svg = d3.select(vis.parentElement).append("svg")
		.attr("width", vis.width + vis.margin.left + vis.margin.right)
		.attr("height", vis.height + vis.margin.top + vis.margin.bottom);

	vis.svgMap = vis.svg.append("g")
		.attr("transform", "translate(" + vis.margin.left + "," + vis.margin.top + ")")
		.call(vis.tip);


	// Timeline - Histogram
	vis.marginTimeline = {top: 610, right: 250, bottom: 50, left: 40};

	vis.widthTimeline = 1200 - vis.marginTimeline.left - vis.marginTimeline.right;
	vis.heightTimeline = 800 - vis.marginTimeline.top - vis.marginTimeline.bottom;

	vis.svgTimeline = vis.svg.append("g")
		.attr("transform", "translate(" + vis.marginTimeline.left + "," + vis.marginTimeline.top + ")");

	// Legend
	vis.marginLegend = {top: 650, right: 10, bottom: 50, left: 1000};

	vis.widthLegend = 1200 - vis.marginLegend.left - vis.marginLegend.right;
	vis.heightLegend = 800 - vis.marginLegend.top - vis.marginLegend.bottom;

	vis.svgLegend = vis.svg.append("g")
		.attr("transform", "translate(" + vis.marginLegend.left + "," + vis.marginLegend.top + ")");
};


WorldMap.prototype.setupScale = function() {
	var vis = this;

	vis.xTimeline = d3.time.scale()
		.range([0, vis.widthTimeline])
		.clamp(true);

	vis.yTimeline = d3.scale.linear()
		.range([vis.heightTimeline, 0]);

	vis.x = d3.time.scale()
		.range([0, vis.width]);

	vis.y = d3.scale.linear()
		.range([vis.height, 0]);

	vis.color = d3.scale.ordinal()
		.range(["#2ca02c", "#d62728", "#1f77b4"])
		.domain(vis.disasters);

	vis.brush = d3.svg.brush()
		.x(vis.xTimeline)
		.on("brush", brushed)
		.on("brushend", brushed);

	function brushed() {
		 vis.rangeDates = vis.brush.empty() ? vis.xTimeline.domain() : vis.brush.extent();
		 vis.filteredData = vis.data.filter(function(d){
		 	return vis.formatDate(vis.rangeDates[0]) <= vis.formatDate(d.TIME) && vis.formatDate(d.TIME) <= vis.formatDate(vis.rangeDates[1]);
		 });
		 if (vis.selectedData == "all") {
		 	vis.svgTimeline.selectAll(".rect").classed("hidden-bar", function (d) {
		 		return !(vis.formatDate(vis.rangeDates[0]) <= vis.formatDate(d.date) && vis.formatDate(d.date) <= vis.formatDate(vis.rangeDates[1]));
		 	});
		 } else {
		 	vis.svgTimeline.selectAll(".bar").classed("hidden-bar", function (d) {
		 		return !(vis.formatDate(vis.rangeDates[0]) <= vis.formatDate(d.date) && vis.formatDate(d.date) <= vis.formatDate(vis.rangeDates[1]));
			});
		 }
		 vis.updateMap();
	 }

};

WorldMap.prototype.setupAxes = function() {
	var vis = this;

	vis.xAxisTimeline = d3.svg.axis()
		.scale(vis.xTimeline)
		.orient("bottom")
		.tickSize("0");

	vis.yAxisTimeline = d3.svg.axis()
		.scale(vis.yTimeline)
		.orient("left");

};

WorldMap.prototype.setupProjection = function() {
	var vis = this;

	vis.projection = d3.geo.naturalEarth() //orthographic().mercator()
		.translate([vis.width / 2, vis.height / 2])
		.center([40,0])
		.scale(200)
		.precision(1.0);

	vis.path = d3.geo.path()
		.projection(vis.projection);

	vis.svgMap.append("path")
		.datum({type: "Sphere"})
		.attr("d", vis.path)
		.style("fill", "#e0f3f8");
};


WorldMap.prototype.updatePlates = function() {
	var vis = this;
	vis.showPlates = d3.select("#checkbox-plates").property("checked");
	d3.selectAll(".plates").classed("hidden", function(){return !vis.showPlates})
};

WorldMap.prototype.displayVis = function() {
	var vis = this;

	vis.radiusScale["Earthquake"] = d3.scale.linear()
		.range([2, 30])
		.domain([6, d3.extent(vis.allData.filter(function(d){ return d.CATEGORY == "Earthquake"}), function(d){
			return d.MAGNITUDE;
		})[1]]);

	vis.radiusScale["Volcano"] = d3.scale.linear()
		.range([2, 30])
		.domain(d3.extent(vis.allData.filter(function(d){ return d.CATEGORY == "Volcano"}), function(d){
			return d.MAGNITUDE;
		}));

	vis.radiusScale["Tsunami"] = d3.scale.linear()
		.range([2, 30])
		.domain(d3.extent(vis.allData.filter(function(d){ return d.CATEGORY == "Tsunami"}), function(d){
			return d.MAGNITUDE;
		}));

	vis.svgMap.append("g").selectAll("path")
		.data(vis.world)
		.enter().append("path")
		.attr("class", "path")
		.attr("d", vis.path);

	vis.svgMap.append("g").selectAll(".plates")
		.data(vis.plates)
		.enter().append("path")
		.attr("class", "plates")
		.attr("d", vis.path);

	vis.svgTimeline.append("g")
		.attr("class", "x-axis axis");

	vis.svgTimeline.append("g")
		.attr("class", "y-axis axis");

	vis.svgTimeline.select(".x-axis")
		.attr("transform", "translate(0," + vis.heightTimeline + ")");

	vis.svgTimeline.select(".y-axis")
		.attr("transform", "translate(0,0)");

	vis.svgTimeline.selectAll(".x-axis").append("g")
		.attr("class", "label x-label")
		.append("text")
		.text("Year")
		.attr("transform", "translate(" + (vis.widthTimeline - 20) + ", 15)");

	vis.svgTimeline.selectAll(".y-axis").append("g")
		.attr("class", "label y-label")
		.append("text")
		.style("text-anchor", "middle")
		.text("Number of events")
		.attr("transform", "translate(-30," + (vis.heightTimeline / 2) + ") rotate(-90)");

	vis.updateHistogram();
};


WorldMap.prototype.updateHistogram = function() {

	var vis = this;

	vis.selectedData = d3.select("#map-data").property("value");
	d3.selectAll(".brush").call(brushMapClear());

	if (vis.selectedData == "all"){
		vis.data = vis.allData;
	} else {
		vis.data = vis.allData.filter(function (d) {
			return d.CATEGORY == vis.selectedData;
		})
	}
	vis.filteredData = vis.data;

	// TIMELINE
	vis.xTimeline.domain(d3.extent(vis.allData, function(d){
		return d.TIME;
	}));

	vis.rangeDates = vis.xTimeline.domain();


	vis.timelineData = [];
	vis.dateRange = d3.time.year.range(vis.xTimeline.domain()[0], vis.xTimeline.domain()[1]);

	vis.dateRange.forEach(function(currentDate){
		if (vis.selectedData == "all"){
			var y0 = 0;
			vis.timelineData.push({
				date: currentDate,
				values: vis.color.domain().map(function (disasterType) {
					return {
						type: disasterType,
						date: currentDate,
						y0: y0,
						y1: y0 += vis.filteredData.filter(function (d) {
							return (vis.formatDate(d.TIME) == vis.formatDate(currentDate) && d.CATEGORY == disasterType);
						}).length
					}
				}),
				total: y0
			})
		} else {
			vis.timelineData.push({
				date: currentDate,
				total: vis.filteredData.filter(function (d) {
					return vis.formatDate(d.TIME) == vis.formatDate(currentDate);
				}).length
			})
		}
	});

	vis.yTimeline.domain([0, d3.extent(vis.timelineData, function(d){return d.total;})[1]]);

	// Timeline
	d3.selectAll(".bar").remove();

	vis.bars = vis.svgTimeline.append("g").attr("class", "bars")
		.selectAll(".bar")
		.data(vis.timelineData);


	if (vis.selectedData == "all") {

		vis.bars.enter().append("g")
			.attr("class", "bar");

		vis.rects = vis.bars.selectAll("rect")
			.data(function(d) { return d.values; });

		vis.rects.enter().append("rect")
			.attr("class", "rect");

		vis.rects.attr("x", function (d) {
				return vis.xTimeline(d.date);
			})
			.attr("width", vis.widthTimeline / vis.dateRange.length)
			.attr("y", function(d) { return vis.yTimeline(d.y1); })
			.attr("height", function(d) { return vis.yTimeline(d.y0) - vis.yTimeline(d.y1); })
			.style("fill", function(d) { return vis.color(d.type); })

	} else {

		vis.bars.enter().append("rect")
			.attr("class", "bar");

		vis.bars.attr("x", function (d) {
				return vis.xTimeline(d.date);
			})
			.attr("width", vis.widthTimeline / vis.dateRange.length - 0.1)
			.attr("y", function (d) {
				return vis.yTimeline(d.total);
			})
			.attr("height", function (d) {
				return vis.heightTimeline - vis.yTimeline(d.total);
			})
			.attr("fill", vis.color(vis.selectedData))
	}

	vis.svgTimeline.select(".x-axis")
		.call(vis.xAxisTimeline)
		.selectAll(".tick");

	vis.svgTimeline.select(".y-axis")
		.call(vis.yAxisTimeline);

	vis.svgTimeline.append("g")
		.attr("class", "x brush")
		.call(vis.brush)
		.selectAll("rect")
		.attr("y", 0)
		.attr("height", vis.heightTimeline);

	vis.updateLegend();
	vis.updateMap();

};

WorldMap.prototype.updateLegend = function() {
	var vis = this;

	vis.legendData = [];

	if (vis.selectedData == "all"){
		vis.categories = vis.disasters;
	} else {
		vis.categories = [vis.selectedData];
	}

	for (var idx in vis.categories) {
		vis.legendData.push({MAGNITUDE: vis.radiusScale[vis.categories[idx]].domain()[0],
						CATEGORY: vis.categories[idx]});
		vis.legendData.push({MAGNITUDE: (vis.radiusScale[vis.categories[idx]].domain()[0]+vis.radiusScale[vis.categories[idx]].domain()[1])/2,
						CATEGORY: vis.categories[idx]});
		vis.legendData.push({MAGNITUDE: vis.radiusScale[vis.categories[idx]].domain()[1],
						CATEGORY: vis.categories[idx]});
	}

	vis.legend = vis.svgLegend.selectAll("circle")
		.data(vis.legendData);

	vis.legend.enter()
		.append("circle");

	vis.legend.exit()
		.remove();

	vis.legend.attr("cx", function(d, i) {
			return Math.floor(i / 3) * (vis.widthLegend / 3);
		})
		.attr("cy", function(d){
			return 50 - vis.radius(d)
		})
		.style("fill", function(d){return vis.color(d.CATEGORY);})
		.style("fill-opacity", 0.05)
		.style("stroke", function(d){return vis.color(d.CATEGORY);})
		.style("stroke-width", "0.5px")
		.style("stroke-opacity", 1)
		.attr("r", function(d) {
			return vis.radius(d);
		});

	vis.legendText = vis.svgLegend.selectAll("text")
		.data(vis.legendData);

	vis.legendText.enter()
		.append("text");

	vis.legendText.exit()
		.remove();

	vis.legendText.attr("x", function(d, i) {
			return Math.floor(i / 3) * (vis.widthLegend / 3);
		})
		.attr("y", function(d){
			return 50 - 2 * vis.radius(d) - 5
		})
		.attr("font-size", "10px")
		.style("text-anchor", "middle")
		.text(function(d) {
			return "" + d.MAGNITUDE.toFixed(1)
		});

	vis.legendLabel = vis.svgLegend.selectAll(".legendLabel")
		.data(vis.categories);

	vis.legendLabel.enter()
		.append("text");

	vis.legendLabel.exit()
		.remove();

	vis.legendLabel.each(function(d, i){
		var label, el = d3.select(this);
		if (d == "Earthquake"){
			label = "Earthquake Magnitude (Richter)"
		} else if (d == "Volcano"){
			label = "Volcanic Explosivity Index"
		} else if (d == "Tsunami"){
			label = "Tsunami Magnitude (Iida-Imamura)"
		}
		var words = label.split(' ');
		el.text('');
		for (var j = 0; j < words.length; j++) {
			var tspan = el.append('tspan').text(words[j]);
			tspan.attr("x", i * (vis.widthLegend / 3))
				.attr("y", 60 + j * 11)
				.attr("font-size", "10px")
				.style("text-anchor", "middle")
		}

	})
};

WorldMap.prototype.updateMap = function() {
	var vis = this;

	vis.filteredData = vis.filteredData.sort(function(a, b){return vis.radius(b) - vis.radius(a);});

	vis.tip.html(function(d){
		var magLabel;
		if (d.CATEGORY == "Earthquake"){
			magLabel = "Richter magnitude"
		} else if (d.CATEGORY == "Tsunami"){
			magLabel = "Iida-Imamura magnitude"
		} else if (d.CATEGORY == "Volcano"){
			magLabel = "Volcanic Explosivity Index"
		}
		return "" + (d.CATEGORY == "Volcano" ? "Volcanic eruption" : d.CATEGORY) + "</br>" +
			"Date: " + vis.textDate(new Date(d.YEAR, d.MONTH, d.DAY)) + "</br>" +
			"Location: " + d.COUNTRY.charAt(0).toUpperCase() + d.COUNTRY.slice(1).toLowerCase() + "</br>" +
			"Coordinates: (" + d.LATITUDE + ", " + d.LONGITUDE + ")" + "</br>" +
			magLabel + ": " + d.MAGNITUDE
	});


	vis.events = vis.svgMap.selectAll("circle.circle-event")
		.data(vis.filteredData);

	vis.events.enter()
		.append("circle");

	vis.events.attr("class", "circle-event")
		.attr("cx", function(d) {
			return vis.projection([d.LONGITUDE, d.LATITUDE])[0];
		})
		.attr("cy", function(d) {
			return vis.projection([d.LONGITUDE, d.LATITUDE])[1];
		})
		.style("fill", function(d){return vis.color(d.CATEGORY);})
		.style("fill-opacity", 0.05)
		.style("stroke", function(d){return vis.color(d.CATEGORY);})
		.style("stroke-width", "0.5px")
		.style("stroke-opacity", 1)
		.on("mouseover", function(d){
			vis.tip.show(d);
			d3.select(this).style("fill-opacity", 1)
		})
		.on("mouseout", function(d){
			vis.tip.hide(d);
			d3.select(this).style("fill-opacity", 0.05)
		})
		.attr("r", function(d) {
			return vis.radius(d);
		});

	// remove circles for old earthquakes no longer in data
	vis.events.exit()
		.transition()
		.attr("r", 0)
		.style("fill-opacity", 0)
		.remove();

	vis.legendMap = vis.svg.selectAll(".text-title")
		.data([vis.rangeDates]);

	vis.legendMap.enter()
		.append("text");

	vis.legendMap.exit()
		.remove();

	vis.legendMap.attr("class", "text-title")
		.attr("x", 1200 / 2)
		.attr("y", vis.margin.top / 2)
		.attr("font-size", "18px")
		.attr("text-anchor", "middle")
		.text(function(d) {
			var mapLabel;
			if (vis.selectedData == "all"){
				mapLabel = "Natural disasters"
			} else if (vis.selectedData == "Earthquake"){
				mapLabel = "Earthquakes"
			} else if (vis.selectedData == "Tsunami"){
				mapLabel = "Tsunamis"
			} else if (vis.selectedData == "Volcano"){
				mapLabel = "Volcanic eruptions"
			}
			return mapLabel + " from " + vis.formatDate(d[0]) + " to " + vis.formatDate(d[1])
		})
};


WorldMap.prototype.radius = function(d) {
	var vis = this;
	return vis.radiusScale[d.CATEGORY](d.MAGNITUDE);
};

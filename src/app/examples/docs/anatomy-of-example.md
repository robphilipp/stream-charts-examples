### anatomy of an example chart

Before we dive into the details of the each example chart, let's take a look at one of the tabs in the example application. In this particular example, we're looking at the "Scatter" chart. And figure 3 breaks down what you see.

<figure>
    <img src="./public/images/intro-example-parts.png" alt="Anatomy of an Example Chart">
    <figcaption>
        <b>Figure 3</b> The anatomy of an example chart. The "Tabs" provide this page and a page that holds an example for each chart type available in the library. The "Control bar" has controls that provide common features of each chart type and features that are specific to each chart type. The "Tabs" and "Control bar" are part of the example application and are not distributed in the library. The "Chart" holds an example chart – in this case a "Scatter" chart. The "Chart" is an example of a chart type that is provided in the [stream-charts](https://www.npmjs.com/package/stream-charts) library.
    </figcaption>
</figure>

The "Tabs" are at the top of the page and allow you to navigate to the different chart types available in the library. Enough said.

The next two items, "Control bar" and "Chart" represent the example. The "Control bar" has controls that are common to all examples, such as the "regex filter", the "Run", "Clear"/"Pause" button, the tooltip checkbox, the tracker checkbox, and the "lag" display. The remaining controls are specific to each chart. For example, for the scatter chart, we can interpolate the lines between the points in different ways, and so there is a drop-down that allows you to select the interpolation. Similarly, markers make sense for a scatter chart, but less so for a bar chart. 

We'll talk in more detail about the common controls on this page. We'll discuss the controls specific to the each chart type in the later pages.

#### common controls

- **regex filter** – A text input for selecting which time-series(es) to display using a regular expression on the series names
- **Run/Pause, Clear button** – A chart displays initial time-series. The **Run** button starts streaming data into the chart. Once the data is streaming, the **Run** button turns into the **Pause** button, which pauses the stream of data. The **Clear** button resets the data in the chart to its initial data. 
- **tooltip checkbox** – When the **tooltip** checkbox is selected, mousing over a series will display a tooltip about that series, or data point. When creating your own charts, you can create your own tooltips in SVG or in HTML. Tooltips are generally disabled while the data is streaming.
- **tracker checkbox** – a checkbox that allows you to toggle the display of trackers
- **lag display** – a display that shows the lag between the data stream and the chart
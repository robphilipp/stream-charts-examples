import type {Theme} from "../ui/Themes.ts";

type Props = {
    theme: Theme
}

export default function Intro(props: Props) {
    const {theme} = props

    const html = `
<p>
This application contains examples of using the <a href="https://www.npmjs.com/package/stream-charts" target="_blank">stream-charts</a> library.
Each tab in this application contains an example chart for one of the available stream-charts plot types. Each of these
example charts implements the full feature-set of the stream-charts library.
</p>
<p>
The stream-charts library is designed to display real-time time-series data. Each chart has an 
<a href="https://rxjs.dev/" target="_blank">RxJS</a> Observer that receives data from an 
<a href="https://rxjs.dev/" target="_blank">RxJS</a> Observable. The data is displayed in real time as it streams into 
the chart. 
</p>
<figure style="padding-left: 0; margin-left: 10px; min-width: 720px;">
    <img src="../../../public/intro/toolbar.png" alt="Example Controls" style="max-width: 700px; height: auto;">
    <figcaption style="font-size: 12px;">
        <b>Figure 1</b> Controls are part of the example application rather than part of the stream-charts library. The controls
        shown here are part of the streaming scatter chart example.
    </figcaption>
</figure>
<p>
The example charts in this application provide a set of controls that can be used to adjust the chart's behavior.
These controls are placed above the chart. For example, in the scatter chart example there is a checkbox that enables
the tooltip when the user mouses over a series. There is also a marker checkbox that displays markers for each data 
point. A dropdown enables the user to select the interpolation method used to draw the lines between data points. And
a legend checkbox enables you to toggle the visibility of the legend. When the legend is visible, you're
presented with a legend dropdown that allows you to select the placement of the legend.
</p>
<p>
These controls are part of this <em>example application</em> and are <b>not</b> part of the <em>stream-charts</em> library. 
</p>
<p>
When you use
the stream-charts library, you can create interactive and customizable charts for your data visualization needs.
</p>
<p>
The charts in the following tab are example usages of the  
<a href="https://www.npmjs.com/package/stream-charts" target="_blank">stream-charts</a>  
library.
</p>
`

    return (
        <div
            style={{
                backgroundColor: theme.backgroundColor,
                color: theme.color,
                width: 'auto',
                paddingRight: 20,
                paddingLeft: 20,
                maxWidth: 750
            }}
            dangerouslySetInnerHTML={{__html: html}}
        >
        </div>
    )
}
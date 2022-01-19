import React, {useState, useEffect} from 'react';
import * as d3 from 'd3';
import {componentAtomTree, atom, selector} from '../../../types';
import {useAppSelector, useAppDispatch} from '../../state-management/hooks';
import {
  updateZoomState,
  selectZoomState,
  setDefaultZoom,
} from '../../state-management/slices/ZoomSlice';

interface AtomComponentVisualProps {
  componentAtomTree: componentAtomTree;
  cleanedComponentAtomTree: componentAtomTree;
  selectedRecoilValue: string[];
  atoms: atom;
  selectors: selector;
  setStr: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedRecoilValue: React.Dispatch<React.SetStateAction<string[]>>;
}

const AtomComponentVisual: React.FC<AtomComponentVisualProps> = ({
  componentAtomTree,
  cleanedComponentAtomTree,
  selectedRecoilValue,
  atoms,
  selectors,
  setStr,
  setSelectedRecoilValue,
}) => {

  const zoomSelector = useAppSelector(selectZoomState);
  const {x, y, k} = zoomSelector;
  const dispatch = useAppDispatch();

  // set the heights and width of the tree to be passed into treeMap function
  let width: number = 0;
  let height: number = 0;

  // useState hook to update the toggle of displaying entire tree or cleaned tree
  const [rawToggle, setRawToggle] = useState<boolean>(false);

  // useState hook to update whether a suspense component will be shown on the component graph
  const [hasSuspense, setHasSuspense] = useState<boolean>(false);

  //declare hooks to render lists of atoms or selectors
  const [atomList, setAtomList] = useState(Object.keys(atoms));
  const [selectorList, setSelectorList] = useState(Object.keys(selectors));

  // need to create a hook for toggling
  const [showAtomMenu, setShowAtomMenu] = useState<boolean>(false);
  const [showSelectorMenu, setShowSelectorMenu] = useState<boolean>(false);

  // hook for selected button styles on the legend
  const [atomButtonClicked, setAtomButtonClicked] = useState<boolean>(false);
  const [selectorButtonClicked, setSelectorButtonClicked] = useState<boolean>(
    false,
  );
  const [bothButtonClicked, setBothButtonClicked] = useState<boolean>(false);
  const [isDropDownItem, setIsDropDownItem] = useState<boolean>(false);

  useEffect(() => {
    height = document.querySelector('.Component').clientHeight;
    width = document.querySelector('.Component').clientWidth;

    document.getElementById('canvas').innerHTML = '';

    // reset hasSuspense to false. This will get updated to true if the red borders are rendered on the component graph.
    setHasSuspense(false);

    // creating the main svg container for d3 elements
    const svgContainer = d3.select('#canvas');

    // creating a pseudo-class for reusability
    const g = svgContainer
      .append('g')
      // .attr('transform', `translate(${x}, ${y}), scale(${k})`)
      .attr('id', 'componentGraph')
      .attr('viewBox', [-width / 2, -height / 2, width, height]);

    let i = 0;
    let duration: number = 750;
    let root: any;
    let path: string;

    // creating the tree map
    const treeMap = d3.tree().nodeSize([height, width]);

    if (!rawToggle) {
      root = d3.hierarchy(
        cleanedComponentAtomTree,
        function (d: componentAtomTree) {
          return d.children;
        },
      );
    } else {
      root = d3.hierarchy(componentAtomTree, function (d: componentAtomTree) {
        return d.children;
      });
    }

    // Node distance from each other
    root.x0 = 500;
    root.y0 = width / 2;

    update(root);

    // d3 zoom functionality
    let zoom = d3.zoom().on('zoom', zoomed);

    svgContainer.call(
      zoom.transform,
      // Changes the initial view, (left, top)
      d3.zoomIdentity.translate(x, y).scale(k),
    );

    // allows the canvas to be zoom-able
    svgContainer.call(
      d3
        .zoom()
        .scaleExtent([0.05, 0.9]) // [zoomOut, zoomIn]
        .on('zoom', zoomed),
    );

    // helper function that allows for zooming
    function zoomed() {
      g.attr('transform', d3.event.transform).on(
        'mouseup',
        dispatch(
          updateZoomState(d3.zoomTransform(d3.select('#canvas').node())),
        ),
      );
    }

    // Update function
    function update(source: any) {
      treeMap(root);

      let nodes = root.descendants(),
        links = root.descendants().slice(1);

      let node = g
        .selectAll('g.node')
        .attr('stroke-width', 5)
        .data(nodes, function (d: any): number {
          return d.id || (d.id = ++i);
        });

      /* this tells node where to be placed and go to
       * adding a mouseOver event handler to each node
       * display the data in the node on hover
       * add mouseOut event handler that removes the popup text
       */
      //add div that will hold info regarding atoms and/or selectors for each node
      const tooltip = d3
        .select('.tooltipContainer')
        .append('div')
        .attr('class', 'hoverInfo')
        .style('opacity', 0);

      let nodeEnter = node
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', function (): string {
          return `translate(${source.y0}, ${source.x0})`;
        })
        .on('click', click)
        .on('mouseover', function (d: any, i: number): void {
          // atsel is an array of all the atoms and selectors
          const atsel: any = [];

          if (d.data.recoilNodes) {
            for (let x = 0; x < d.data.recoilNodes.length; x++) {
              // pushing all the atoms and selectors for the node into 'atsel'
              atsel.push(d.data.recoilNodes[x]);
            }
            // change the opacity of the node when the mouse is over
            d3.select(this).transition().duration('50').attr('opacity', '.85');

            // created a str for hover div to have corrensponding info
            // let newStr = formatAtomSelectorText(atsel).join('<br>');
            // newStr = newStr.replace(/,/g, '<br>');
            // newStr = newStr.replace(/{/g, '<br>{');

            // to make the info-windows more clear for the user, this iterates over the nodeData and returns a stringified html element that gets rendered by the tooltip
            const nodeData = formatAtomSelectorText(atsel)[0];

            const genHTML = (obj: any): string => {
              let str = '';
              let htmlStr = '';
              for (let key in obj) {
                const curr = obj[key];

                if (key === 'type') str += `${curr}: `;
                if (key === 'name') str += curr;

                if (key === 'info') {
                  htmlStr += `<h3>${str}</h3>`;
                  htmlStr += `<h5>Atomic Values</h5>`;
                  if (typeof curr === 'string')
                    htmlStr += `<p>title: ${curr}</p>`;
                  else
                    for (let prop in curr) {
                      const title = prop;
                      const data = curr[prop];
                      htmlStr += `<p>${title}: ${data}</p>`;
                    }
                }
              }
              return `<div>${htmlStr}</div>`;
            };

            // tooltip appear near your mouse when hover over a node
            tooltip
              .style('opacity', 1)
              .html(genHTML(nodeData))
              .style('left', d3.event.pageX + 15 + 'px') // mouse position
              .style('top', d3.event.pageY - 20 + 'px');
          }
        })
        .on('mouseout', function (d: any, i: number): void {
          d3.select(this).transition().duration('50').attr('opacity', '1'); //change the opacity back
          //remove tooltip when the mouse is not on the node
          tooltip.style('opacity', 0);
        });

      // determines shape/color/size of node
      nodeEnter
        .append('circle')
        .attr('class', 'node')
        .attr('r', determineSize)
        .attr('fill', colorComponents)
        .style('stroke', borderColor)
        .style('stroke-width', 15);
      // TO DO: Add attribute for border if it is a suspense component

      // for each node that got created, append a text element that displays the name of the node
      nodeEnter
        .append('text')
        .attr('dy', '.31em')
        .attr('y', (d: any): number => (d.data.recoilNodes ? 138 : -75))
        .attr('text-anchor', function (d: any): string {
          return d.children || d._children ? 'middle' : 'middle';
        })
        .text((d: any): string => d.data.name)
        .style('font-size', `7.5rem`)
        .style('fill', 'white');

      let nodeUpdate = nodeEnter.merge(node);

      // transition that makes it slide down to next spot
      nodeUpdate
        // .transition()
        // .duration(duration)
        .attr('transform', function (d: any): string {
          return `translate(${d.y}, ${d.x})`;
        });

      // allows user to see hand pop out when clicking is available and maintains color/size
      nodeUpdate
        .select('circle.node')
        .attr('r', determineSize)
        .attr('fill', colorComponents)
        .attr('cursor', 'pointer')
        .style('stroke', borderColor)
        .style('stroke-width', 15);

      let nodeExit = node
        .exit()
        .transition()
        .duration(duration)
        .attr('transform', function (d: any): string {
          return `translate(${source.y}, ${source.x})`;
        })
        .remove();

      let link = g
        .attr('fill', 'none')
        .attr('stroke-width', 5)
        .selectAll('path.link')
        .data(links, function (d: any): number {
          return d.id;
        });

      let linkEnter = link
        .enter()
        .insert('path', 'g')
        .attr('class', 'link')
        .attr('stroke', '#646464')
        .attr('stroke-width', 5)
        .attr('d', function (d: any): string {
          let o = {x: source.x0, y: source.y0};
          return diagonal(o, o);
        });

      let linkUpdate = linkEnter.merge(link);

      linkUpdate
        .transition()
        .duration(duration)
        .attr('stroke', '#646464')
        .attr('stroke-width', 5)
        .attr('d', function (d: any): string {
          return diagonal(d, d.parent);
        });

      let linkExit = link
        .exit()
        .transition()
        .duration(duration)
        .attr('stroke', '#646464')
        .attr('stroke-width', 5)
        .attr('d', function (d: any): string {
          let o = {y: source.y, x: source.x};
          return diagonal(o, o);
        })
        .remove();

      // makes next Node needed to appear from the previous and not the start
      nodes.forEach(function (d: any): void {
        d.x0 = d.x;
        d.y0 = d.y;
      });

      function diagonal(s: any, d: any): string {
        path = `M ${s.y} ${s.x}
            C ${(s.y + d.y) / 2} ${s.x},
              ${(s.y + d.y) / 2} ${d.x},
              ${d.y} ${d.x}`;

        return path;
      }

      function click(d: any): void {
        if (d.children) {
          d._children = d.children;
          d.children = null;
        } else {
          d.children = d._children;
          d._children = null;
        }

        update(d);
        const atsel = [];
        if (d.data.recoilNodes) {
          for (let x = 0; x < d.data.recoilNodes.length; x++) {
            atsel.push(d.data.recoilNodes[x]);
          }
          setStr(formatAtomSelectorText(atsel));
        }
      }

      // allows the canvas to be draggable
      node.call(d3.drag());

      function formatMouseoverXValue(recoilValue: string): number {
        if (atoms.hasOwnProperty(recoilValue)) {
          return -30;
        }
        return -150;
      }

      // creates an array of objects with node data
      function formatAtomSelectorText(atomOrSelector: string[]): string[] {
        const recoilData: any = [];

        for (let i = 0; i < atomOrSelector.length; i++) {
          const data: any = {};
          const curr = atomOrSelector[i];

          data.type = atoms.hasOwnProperty(curr) ? 'atom' : 'selector';
          data.name = curr;

          if (data.type === 'atom') {
            data.info = atoms[curr];
          } else {
            data.info = selectors[curr];
          }

          recoilData.push(data);
        }

        return recoilData;
      }

      function determineSize(d: any): number {
        if (d.data.recoilNodes && d.data.recoilNodes.length) {
          if (d.data.recoilNodes.includes(selectedRecoilValue[0])) {
            // Size when the atom/selector is clicked on from legend
            return 150;
          }
          // Size of atoms and selectors
          return 100;
        }
        // Size of regular nodes
        return 50;
      }

      function borderColor(d: any): string {
        if (d.data.wasSuspended) setHasSuspense(true);
        return d.data.wasSuspended ? '#FF0000' : 'none';
      }

      function colorComponents(d: any): string {
        // if component node contains recoil atoms or selectors, make it orange red or yellow, otherwise keep node gray
        if (d.data.recoilNodes && d.data.recoilNodes.length) {
          if (d.data.recoilNodes.includes(selectedRecoilValue[0])) {
            // Color of atom or selector when clicked on in legend
            return 'yellow';
          }

          let hasAtom = false;
          let hasSelector = false;
          for (let i = 0; i < d.data.recoilNodes.length; i++) {
            if (atoms.hasOwnProperty(d.data.recoilNodes[i])) {
              hasAtom = true;
            }
            if (selectors.hasOwnProperty(d.data.recoilNodes[i])) {
              hasSelector = true;
            }
          }
          if (hasAtom && hasSelector) {
            return 'springgreen';
          }
          if (hasAtom) {
            return '#9580ff';
          } else {
            return '#ff80bf';
          }
        }
        return 'gray';
      }
    }
  }, [componentAtomTree, rawToggle, selectedRecoilValue]);

  // setting the component's user interface state by checking if the dropdown menu is open or not
  function openDropdown(e: React.MouseEvent) {
    const target = e.target as Element;
    if (target.id === 'AtomP') {
      setAtomButtonClicked(true);
      setSelectorButtonClicked(false);
      setShowAtomMenu(!showAtomMenu);
      setShowSelectorMenu(false);
    } else {
      setAtomButtonClicked(false);
      setSelectorButtonClicked(true);
      setShowSelectorMenu(!showSelectorMenu);
      setShowAtomMenu(false);
    }
  }

  // resetting the component's user interface state when toggling between atoms & selectors
  const resetNodes = () => {
    setIsDropDownItem(false);
    setSelectedRecoilValue([]);
    setShowSelectorMenu(false);
    setShowAtomMenu(false);
    setAtomButtonClicked(false);
    setSelectorButtonClicked(false);
  };

  return (
    <div className="AtomComponentVisual">
      <svg id="canvas"></svg>
      <button
        id="fixedButton"
        style={{
          color: rawToggle ? '#E6E6E6' : '#989898',
        }}
        onClick={() => {
          setRawToggle(!rawToggle);
          dispatch(setDefaultZoom());
        }}>
        <span>{rawToggle ? 'Collapse' : 'Expand'}</span>
      </button>
      <div className="AtomNetworkLegend">
        <div className="AtomLegend" />
        <button
          onClick={isDropDownItem ? resetNodes : openDropdown}
          id="AtomP"
          className={
            atomButtonClicked ? 'AtomP atomSelected' : 'AtomP atomLegendDefault'
          }>
          ATOM
        </button>
        {showAtomMenu && (
          <div id="atomDrop" className="AtomDropDown">
            {atomList.map((atom, i) => (
              <div className="dropDownButtonDiv">
                <button
                  id={`atom-drop${i}`}
                  className="atom-class atomDropDown"
                  key={i}
                  onClick={event => {
                    if (
                      !(event.target as HTMLInputElement).classList.contains(
                        'atomSelected',
                      ) &&
                      (event.target as HTMLInputElement).classList.contains(
                        'atomNotSelected',
                      )
                    ) {
                      (event.target as HTMLInputElement).classList.replace(
                        'atomNotSelected',
                        'atomSelected',
                      );
                    } else if (
                      !(event.target as HTMLInputElement).classList.contains(
                        'atomSelected',
                      ) &&
                      !(event.target as HTMLInputElement).classList.contains(
                        'atomNotSelected',
                      )
                    ) {
                      (event.target as HTMLInputElement).classList.add(
                        'atomSelected',
                      );
                    }

                    document.querySelectorAll('.atom-class').forEach(item => {
                      if (
                        item.id !== `atom-drop${i}` &&
                        item.classList.contains('atomSelected')
                      ) {
                        item.classList.replace(
                          'atomSelected',
                          'atomNotSelected',
                        );
                      } else if (
                        item.id !== `atom-drop${i}` &&
                        !item.classList.contains('atomNotSelected')
                      ) {
                        item.classList.add('atomNotSelected');
                      }
                    });

                    setSelectedRecoilValue([atom, 'atom']);
                    setIsDropDownItem(true);
                  }}>
                  {atom}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="SelectorLegend"></div>
        <button
          onClick={isDropDownItem ? resetNodes : openDropdown}
          id="SelectorP"
          className={
            selectorButtonClicked
              ? 'SelectorP selectorSelected'
              : 'SelectorP selectorLegendDefault'
          }>
          SELECTOR
        </button>
        {showSelectorMenu && (
          <div id="selectorDrop" className="SelectorDropDown">
            {selectorList.map((selector, i) => (
              <div className="dropDownButtonDiv">
                <button
                  id={`selector-drop${i}`}
                  className="selector-class selectorDropDown"
                  key={i}
                  onClick={event => {
                    if (
                      !(event.target as HTMLInputElement).classList.contains(
                        'selectorSelected',
                      ) &&
                      (event.target as HTMLInputElement).classList.contains(
                        'selectorNotSelected',
                      )
                    ) {
                      (event.target as HTMLInputElement).classList.replace(
                        'selectorNotSelected',
                        'selectorSelected',
                      );
                    } else if (
                      !(event.target as HTMLInputElement).classList.contains(
                        'selectorSelected',
                      ) &&
                      !(event.target as HTMLInputElement).classList.contains(
                        'selectorNotSelected',
                      )
                    ) {
                      (event.target as HTMLInputElement).classList.add(
                        'selectorSelected',
                      );
                    }

                    document
                      .querySelectorAll('.selector-class')
                      .forEach(item => {
                        if (
                          item.id !== `selector-drop${i}` &&
                          item.classList.contains('selectorSelected')
                        ) {
                          item.classList.replace(
                            'selectorSelected',
                            'selectorNotSelected',
                          );
                        } else if (
                          item.id !== `selector-drop${i}` &&
                          !item.classList.contains('selectorNotSelected')
                        ) {
                          item.classList.add('selectorNotSelected');
                        }
                      });
                    setSelectedRecoilValue([selector, 'selector']);
                    setIsDropDownItem(true);
                  }}>
                  {selector}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="bothLegend"></div>
        <button className="bothLegendDefault">BOTH</button>
        <div className={hasSuspense ? 'suspenseLegend' : ''}></div>
        <p>{hasSuspense ? 'SUSPENSE' : ''}</p>
        <div className="tooltipContainer"></div>
      </div>
    </div>
  );
};

export default AtomComponentVisual;

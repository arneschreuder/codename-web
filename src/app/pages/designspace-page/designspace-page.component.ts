import { ProjectsService } from './../../_services/projects.service';
import { ActivatedRoute } from '@angular/router';
import { Project } from './../../_models/project.model';
import { ToastsManager } from 'ng2-toastr/ng2-toastr';
import { Response } from '@angular/http';
import { SessionService } from '../../_services/session.service';
import { ComponentsService } from '../../_services/components.service';
import { Component, OnInit, ViewContainerRef, AfterViewInit } from '@angular/core';
import * as d3 from 'd3-selection';
import * as d3Drag from 'd3-drag';
import { UUID } from 'angular2-uuid';

let saveProject = null;
@Component({
  selector: 'app-designspace-page',
  templateUrl: './designspace-page.component.html',
  styleUrls: ['./designspace-page.component.scss']
})
export class DesignspacePageComponent implements OnInit, AfterViewInit {
  private svg: any;
  public width = 900;
  public height = 500;
  public components: any[] = [];
  project: Project;

  // Graph variables
  private nodes: any[] = [];
  private edges: {}[] = [];

  constructor(private componentsService: ComponentsService,
              private sessionService: SessionService,
              private vcr: ViewContainerRef,
              public toastr: ToastsManager,
              public route: ActivatedRoute,
              private projectsService: ProjectsService
  ) {
    this.toastr.setRootViewContainerRef(vcr);
    saveProject = this.saveProject.bind(this);
  }

  ngOnInit() {
    this.initSvg();
    this.loadComponents();
  //   this.route.params.subscribe(params => {
  //     this.loadProject(params['id']);
  //  });
  }

  ngAfterViewInit() {
    this.route.params.subscribe(params => {
      this.loadProject(params['id']);
   });
  }

  private loadProject(id: String) {
    console.log("Calling loadProject()")
    if (id === 'new') {
      this.project = new Project('Untitled Project', '');
      this.projectsService.createProject(this.project)
        .then(project => {
          this.project = project;
        });
    } else {
      console.log("Loading existing project")
      this.projectsService.getProject(id)
        .then(project => {
          console.log("Received response")
          this.project = project;
          // console.log(this.project)
          const nodes = JSON.parse(project.data);
          // console.log(nodes)
          nodes.forEach(node => {
            // console.log(node);
            if (node.componentName === 'Input') {
              this.addInput();
            } else if (node.componentName === 'Output') {
              this.addOutput();
            } else {
              console.log(`Adding ${node.componentName}`);
              this.addNode(node.componentName, 'Math', node.coords);
            }
          });
          // console.log("nodes:")
          console.log(this.nodes);
        });
    }
  }

  click(event: MouseEvent) { }

  addNode(componentName: string, authorName: string, coords?: { x: number, y: number}) {
    if (coords == null) {
      coords = { x: this.width / 2 + 100, y: this.width / 2 + 100}
    }
    let node: any;
    node = {};
    node.id = 'node-' + UUID.UUID();
    node.group = d3.select('#mainsvg').append('g').attr('id', node.id);
    node.edges = { inputs: [], outputs: [] };
    node.coords = { x: this.width / 2 - 200 / 2, y: this.height / 2 - 80 / 2};

    node.outCircle =
    node.group.append('circle')
      .attr('r', 5)
      .attr('cx', coords.x + 200)
      .attr('cy', coords.y + 42.5)
      .attr('fill', 'grey')
      .call(d3Drag.drag()
      .on('start', this.startEdgeDrag)
      .on('drag', this.dragEdge)
      .on('end', this.endEdgeDrag))
      .datum({node: node, type: 'output'});
    node.inCircle =
    node.group.append('circle')
      .attr('r', 5)
      .attr('cx', coords.x)
      .attr('cy', coords.y + 42.5)
      .attr('fill', 'grey')
      .call(d3Drag.drag()
      .on('start', this.startEdgeDrag)
      .on('drag', this.dragEdge)
      .on('end', this.endEdgeDrag))
      .datum({node: node, type: 'input'});
    node.mainRect =
    node.group.append('rect')
      .attr('x', coords.x)
      .attr('y', coords.y)
      .attr('width', 200)
      .attr('height', 80)
      .attr('fill', 'white')
      .attr('stroke-width', '1px')
      .attr('stroke', 'grey')
      .datum({node: node});
    node.headerRect =
    node.group.append('rect')
      .attr('x', coords.x)
      .attr('y', coords.y)
      .attr('width', 200)
      .attr('height', 30)
      .attr('fill', '#D32F2F')
      .datum({node: node});
    node.group.call(d3Drag.drag()
      .on('start', this.startDrag)
      .on('drag', this.drag)
      .on('end', this.endDrag));
      this.nodes.push(node);
    node.text =
    node.group.append('text')
      .attr('text-anchor', 'middle')
      .text(componentName)
      .style('fill', 'white')
      .attr('x', coords.x + 100)
      .attr('y', coords.y + 20);
    node.componentName = componentName;
    node.authorName = authorName;
    node.group.datum({node: node});

    node.update = this.updateNode;
  }

  updateNode = function(x: number, y: number) {
    this.mainRect.attr('x', x);
    this.mainRect.attr('y', y);
    this.headerRect.attr('x', x);
    this.headerRect.attr('y', y);
    this.inCircle.attr('cx', x);
    this.inCircle.attr('cy', y + 40);
    this.outCircle.attr('cx', x + 200);
    this.outCircle.attr('cy', y + 40);
    this.text.attr('x', x + 100);
    this.text.attr('y', y + 20);
  };

  startDrag(d) {
  }

  drag() {
    const self: any = this;
    const x = d3.event.x - 200 / 2;
    const y = d3.event.y - 80 / 2;

    const node = d3.select(this).datum().node;
    node.update(x, y);
    node.coords = { x: x, y: y };

    node.edges.inputs.forEach(edge => {
      const line = edge.line;
      line.attr('x1', d3.select(edge.sourceCircle).attr('cx'));
      line.attr('y1', d3.select(edge.sourceCircle).attr('cy'));
      line.attr('x2', d3.select(edge.targetCircle).attr('cx'));
      line.attr('y2', d3.select(edge.targetCircle).attr('cy'));
    });
    node.edges.outputs.forEach(edge => {
      const line = edge.line;
      line.attr('x1', d3.select(edge.sourceCircle).attr('cx'));
      line.attr('y1', d3.select(edge.sourceCircle).attr('cy'));
      line.attr('x2', d3.select(edge.targetCircle).attr('cx'));
      line.attr('y2', d3.select(edge.targetCircle).attr('cy'));
    });
  }

  endDrag(d) {
    saveProject();
  }

  startEdgeDrag() {
    const x = d3.mouse(d3.select('#mainsvg').node())[0];
    const y = d3.mouse(d3.select('#mainsvg').node())[1];
    d3.select('#edgepath').attr('x1', x).attr('y1', y);
  }

  dragEdge() {
    const edge = d3.select('#edgepath');
    const x = d3.mouse(d3.select('#mainsvg').node())[0];
    const y = d3.mouse(d3.select('#mainsvg').node())[1];
    edge.attr('x2', x).attr('y2', y);
    edge.style('display', 'block');
  }

  endEdgeDrag() {
    d3.select('#edgepath').style('display', 'none');
    const self: any = this;
    const source = self;
    const target = d3.event.sourceEvent.target;
    if (target.tagName === 'circle' && source !== target) {
      const edge: any = {};
      edge.id = 'edge-' + UUID.UUID();
      const x1 = d3.select('#edgepath').attr('x1');
      const y1 = d3.select('#edgepath').attr('y1');
      const x2 = d3.mouse(d3.select('#mainsvg').node())[0];
      const y2 = d3.mouse(d3.select('#mainsvg').node())[1];
      edge.source = d3.select(source).datum().node;
      edge.sourceCircle = source;
      edge.target = d3.select(target).datum().node;
      edge.targetCircle = target;
      edge.line = d3.select('#mainsvg')
        .append('line')
          .attr('class', 'realEdge')
          .style('stroke', 'grey')
          .style('stroke-width', '2px')
          .attr('x1', x1)
          .attr('y1', y1)
          .attr('x2', x2)
          .attr('y2', y2)
          .attr('id', edge.id)
          .datum({edge: edge});
      if (d3.select(target).datum().type === 'input') {
        d3.select(target).datum().node.edges.inputs.push(edge);
        d3.select(source).datum().node.edges.outputs.push(edge);
      } else {
        d3.select(target).datum().node.edges.outputs.push(edge);
        d3.select(source).datum().node.edges.inputs.push(edge);
      }
      saveProject();
    }
  }

  private initSvg() {
    this.svg = d3.select('svg')
                 .append('g');
  }

  private addOutput() {
    let node: any;
    node = {};
    node.id = 'output-' + UUID.UUID();
    node.group = d3.select('#mainsvg').append('g').attr('id', node.id);
    node.edges = { inputs: [], outputs: []};
    node.coords = { x: this.width / 2 - 200 / 2, y: this.width / 2 - 200 / 2};

    node.inCircle =
    node.group.append('circle')
      .attr('r', 5)
      .attr('cx', this.width / 2 - 132)
      .attr('cy', this.height / 2 - 40)
      .attr('fill', 'grey')
      .call(d3Drag.drag()
      .on('start', this.startEdgeDrag)
      .on('drag', this.dragEdge)
      .on('end', this.endEdgeDrag))
      .datum({node: node, type: 'input'});
    node.mainCircle =
    node.group.append('circle')
      .attr('cx', this.width / 2 - 200 / 2)
      .attr('cy', this.height / 2 - 80 / 2)
      .attr('r', 30)
      .attr('fill', '#EEEEEE')
      .attr('stroke-width', '5px')
      .attr('stroke', '#D32F2F')
      .datum({node: node});
    node.text =
    node.group.append('text')
    .attr('text-anchor', 'middle')
    .text('OUT')
    .style('fill', '#D32F2F')
    .attr('x', this.width / 2 - 100)
    .attr('y', this.height / 2 - 34);
    node.group.call(d3Drag.drag()
      .on('start', this.startDrag)
      .on('drag', this.drag)
      .on('end', this.endDrag));
      this.nodes.push(node);
    node.componentName = 'Output';
    node.authorName = 'Base';
    node.group.datum({node: node});

    node.update = function() {
      const x = d3.event.x;
      const y = d3.event.y;
      this.mainCircle.attr('cx', x);
      this.mainCircle.attr('cy', y);
      this.inCircle.attr('cx', x - 32);
      this.inCircle.attr('cy', y);
      this.text.attr('x', x);
      this.text.attr('y', y + 5);
    };
  }

  private addInput() {
    let node: any;
    node = {};
    node.id = 'input-' + UUID.UUID();
    node.group = d3.select('#mainsvg').append('g').attr('id', node.id);
    node.edges = { inputs: [], outputs: []};
    node.coords = { x: this.width / 2 - 200 / 2, y: this.width / 2 - 200 / 2};

    node.inCircle =
    node.group.append('circle')
      .attr('r', 5)
      .attr('cx', this.width / 2 - 68)
      .attr('cy', this.height / 2 - 40)
      .attr('fill', 'grey')
      .call(d3Drag.drag()
      .on('start', this.startEdgeDrag)
      .on('drag', this.dragEdge)
      .on('end', this.endEdgeDrag))
      .datum({node: node, type: 'output'});
    node.mainCircle =
    node.group.append('circle')
      .attr('cx', this.width / 2 - 200 / 2)
      .attr('cy', this.height / 2 - 80 / 2)
      .attr('r', 30)
      .attr('fill', '#EEEEEE')
      .attr('stroke-width', '5px')
      .attr('stroke', '#D32F2F')
      .datum({node: node});
    node.text =
    node.group.append('text')
    .attr('text-anchor', 'middle')
    .text('IN')
    .style('fill', '#D32F2F')
    .attr('x', this.width / 2 - 100)
    .attr('y', this.height / 2 - 34);
    node.group.call(d3Drag.drag()
      .on('start', this.startDrag)
      .on('drag', this.drag)
      .on('end', this.endDrag));
      this.nodes.push(node);
    node.componentName = 'Input';
    node.authorName = 'Base';
    node.group.datum({node: node});
    node.dimensions = ['2', '2'];
    node.values = ['1', '1', '1', '1'];

    node.update = function() {
      const x = d3.event.x;
      const y = d3.event.y;
      this.mainCircle.attr('cx', x);
      this.mainCircle.attr('cy', y);
      this.inCircle.attr('cx', x + 32);
      this.inCircle.attr('cy', y);
      this.text.attr('x', x);
      this.text.attr('y', y + 5);
    };
  }

  private executeSession() {
    const newNodes = this.nodes.map((node) => {
      const resp: any = {
        id: node.id,
        author: node.authorName,
        component: node.componentName,
        edges: {
          inputs: node.edges.inputs.map(edge => {
            return edge.id;
          }),
          outputs: node.edges.outputs.map(edge => {
            return edge.id;
          })
        }
      };
      if (node.componentName === 'Input') {
        resp.dimensions = node.dimensions;
        resp.values = node.values;
      }
      return resp;
    });
    this.sessionService.executeSession(newNodes)
    .catch((res: Response) => {
      console.log(res.json());
      if (res.json().errors) {
        this.toastr.error(res.json().errors[0].detail, null, {showCloseButton: true});
      }
    });
  }

  private loadComponents(): Promise<{}[]> {
    // @todo: Refactor
    return this.componentsService.getComponents()
    .then((res: any) => {
      return new Promise<{}[]>((resolve, reject) => {
        let data: {}[];
        if (JSON.parse(res._body).data === undefined) {
          return [];
        };
        data = JSON.parse(res._body).data.map((item) => {
          return {
            id: item.id,
            description: item.attributes.description,
            name: item.attributes.name,
            stats: item.attributes.stats,
            usage: item.attributes.usage,
            author: item.attributes.author.username
          };
        });
        this.components = data;
      });
    });
  }

  public saveProject() {
    if (this.project !== undefined && this.project !== null) {
      this.project.data = JSON.stringify(this.nodesToJSON());
      this.projectsService.saveProject(this.project);
    }
  }

  private nodesToJSON() {
    return this.nodes.map(n => {
      return {
        id: n.id,
        componentName: n.componentName,
        authorName: n.authorName,
        edges: {
          inputs: n.edges.inputs.map(i => i.id),
          outputs: n.edges.outputs.map(i => i.id),
        },
        coords: n.coords
      };
    });
  }

}

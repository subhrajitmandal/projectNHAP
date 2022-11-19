import { CdkDragDrop, copyArrayItem, transferArrayItem } from '@angular/cdk/drag-drop';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { delay, take, takeUntil } from 'rxjs/operators';
import { SurveyDialogComponent } from '../survey-dialog/survey-dialog.component';
import { SurveyUploadDiagramService } from '../survey-upload-diagram.service';
import { SurveyDataHandlerService } from './../survey-data-handler.service';

@Component({
  selector: 'app-survey-diagram',
  templateUrl: './survey-diagram.component.html',
  styleUrls: ['./survey-diagram.component.scss']
})
export class SurveyDiagramComponent implements OnInit, OnDestroy {

  @Input() enableDrag = false;                  // Used to enable th drag and drop class only when it's in upload section
  surveyDiagramData: Record<string, any> = {};  // Used to store the survey information for diagram display
  uploadImage: Array<string>;                   // Holds the dragged element in this array after it has been dropped
  templateDialogRef: any;                       // Used to display the dialog box when element is dragged
  diagramArr: Array<Record<string, any>>;       // Used to store information related to the dragged element
  diagramForm: FormGroup;

  chainageOrder: number = 1;
  numbersAB: Array<any> = Array(10).fill(0).map((x, i) => i);
  numbersBA: Array<any> = Array(10).fill(0).map((x, i) => i);
  KMStone1Distance: number = 0;
  KMStone2Distance: number = 0;
  KMStonesUIDistance: number = 600;
  KMStone1UIDistance: number = 0;
  KMStone2UIDistance: number = 0;
  topUIDistance: number = 0;
  endSubscription: Subject<void>;

  constructor(private surveyDataService: SurveyDataHandlerService,
              private surveyUploadDiaService: SurveyUploadDiagramService,
              private dialog: MatDialog,
              private fBuilder: FormBuilder) {
    this.uploadImage = [];
    this.diagramArr = [];
    this.endSubscription = new Subject<void>();

    this.diagramForm = this.fBuilder.group({
      KMStone1: [0],
      KMStone2: [0],
      plotChainageNumber: [0],
      plotPlacementA: [0],
      plotPlacementB: [0],
      plotSide: ['LHS'],
      dragDrop: ['[]']
    });
  }

  /**
   * @function: ngOnInit
   * @description: This function handles the initialisation
   * @param: event
   * @returns: void
  */
  ngOnInit(): void {

    this.surveyUploadDiaService.imageUploadDiagramObs
    .pipe(
      take(1)
    )
    .subscribe( (imageArr: Array<Record<string, any>>) => {
      this.diagramArr = imageArr.slice(0);

    });

    this.surveyDataService.surveyDataObs
    .pipe(
      takeUntil(this.endSubscription),
      delay(10)
    )
    .subscribe((surveyData: Record<string, any>) => {
      this.diagramManipulation(surveyData);
    });

    this.diagramForm.valueChanges
    .pipe(
      takeUntil(this.endSubscription)
    )
    .subscribe( () => {
      this.surveyDataService.setStepFormData(this.diagramForm.controls);
    })

    // Adding any changes to the dropped element to the form which in turn saves it in survey data subject
    this.surveyUploadDiaService.imageUploadDiagramObs
    .pipe(
      takeUntil(this.endSubscription)
    )
    .subscribe( (diagram: Array<Record<string, any>>) => {
      this.diagramForm.get('dragDrop')?.patchValue(JSON.stringify(diagram));
    })

  }

  /**
   * @function: ngOnDestroy
   * @description: This function handles the destroy functionality
   * @param: event
   * @returns: void
   */
  ngOnDestroy(): void {
    this.endSubscription.next();
    this.endSubscription.complete();
  }

  /**
   * @function: drop
   * @description: This function handles the drop functionality
   * @param: event
   * @returns: void
   */
   drop(event: CdkDragDrop<any>): void {

      let isUpdateImage: boolean;

      // If movement is from right to left then initialise the dialog box form with existing values.
      if (event.previousContainer.id === "map") {

        const draggedElementValue = this.diagramArr[event.currentIndex];

        const dialogFormValues = {
          isReset: false,
          imageDistance: draggedElementValue.imageDistance ? draggedElementValue.imageDistance : 0,
          imageOrientation: draggedElementValue.imageOrientation ? draggedElementValue.imageOrientation : 1,
          imageWidth: draggedElementValue.imageWidth ? draggedElementValue.imageWidth : '1',
          imagePos: draggedElementValue.imagePos ? draggedElementValue.imagePos : 0,
          roadLength: '1'
        };
    
        this.surveyUploadDiaService.setFormInitialisationStatus(dialogFormValues);
        isUpdateImage = true;

      }
      // If movement is from left to right then reset the form.
      else {

          // reset the form
        const dialogFormValues = {
          isReset: true,
          imageDistance: 0,
          imageOrientation: 1,
          imageWidth: '1',
          imagePos: 0,
          roadLength: '1'
        };

        this.surveyUploadDiaService.setFormInitialisationStatus(dialogFormValues);
        isUpdateImage = false;

      }

      // Get class name as per image and accordingly set the validation status of the dialog form
      if (event.item.element.nativeElement?.firstElementChild?.className.indexOf('intersection') === -1) {
        this.surveyUploadDiaService.setIntersectionStatus(false);
      }
      else {
        this.surveyUploadDiaService.setIntersectionStatus(true);
      }

      // Open dialog box to display the dialog box
      this.templateDialogRef = this.dialog.open(SurveyDialogComponent, {
        disableClose: true,
        hasBackdrop: true,
        data: { formType: event.item.element.nativeElement?.firstElementChild?.className, isUpdateImage: isUpdateImage }
      });
    
      // Once the dialog box is closed then do the necessary changes for image manipulation.
      this.templateDialogRef.afterClosed()
      .pipe(take(1))
      .subscribe((data: Record<string, any>) => {

        this.imageDragManipulation(event, data);
      });
    }

  /**
   * @function: imageDragManipulation
   * @description: This function closes the dialog, manipulation of images and setting of data.
   * @param: event, dialogData
   * @returns: void
  */
  private imageDragManipulation(event: CdkDragDrop<any>, dialogData: Record<string, any>): void {

      // Save the button selection of the dialog
      const status = dialogData.status === 'add' && event.previousContainer.id === 'map' ? 'UPDATE': dialogData.status.toUpperCase();
      let imageMargin = 0;
      const imageName = event.item.element.nativeElement?.firstElementChild?.className
                        .replace('roadComponents', '').replace('droppedRoadComponents', '').replace('ng-star-inserted', '').toUpperCase().trim();

      // Depending on the selection of the buttons in the dialog save, update and delete.
      switch (status) {

        case 'ADD':

            if (parseInt(dialogData.propertyOrientation, 10) === 1) {
              imageMargin = 45;
            }
            else if (parseInt(dialogData.propertyOrientation, 10) === 2) {
              imageMargin = 125;
            }
            else {
              imageMargin = 75;
            }

            const dataRelatedToImage = {
              imageIndex: event.currentIndex,
              imageDistance: dialogData.propertyDistance,
              imageOrientation: parseInt(dialogData.propertyOrientation, 10),
              imageWidth: dialogData.propertyWidth,
              imageMargin: imageMargin,
              imagePos: parseInt(dialogData.propertyPosition, 10),
              imageName: imageName,
              roadLength: dialogData.roadLength
            };

            this.diagramArr[event.currentIndex] = dataRelatedToImage;

            // Set the image array details in subject as well so that it can be accessed from multiple components via service.
            this.surveyUploadDiaService.setImageUploadDiagram(this.diagramArr);

            copyArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);

        break;

        case 'DELETE': 

            // Remove item from container
            const removalArray = new Array();
            transferArrayItem(event.previousContainer.data, removalArray, event.previousIndex, 0);

            // Remove item from D1
            this.diagramArr.splice(event.previousIndex, 1);
            this.surveyUploadDiaService.setImageUploadDiagram(this.diagramArr.slice(0));
        break;

        case 'UPDATE': 

            if (parseInt(dialogData.propertyOrientation, 10) === 1) {
              imageMargin = 45;
            }
            else if (parseInt(dialogData.propertyOrientation, 10) === 2) {
              imageMargin = 125;
            }
            else {
              imageMargin = 75;
            }

            const updateDataRelatedToImage = {
              imageIndex: event.currentIndex,
              imageDistance: dialogData.propertyDistance,
              imageOrientation: parseInt(dialogData.propertyOrientation, 10),
              imageWidth: dialogData.propertyWidth,
              imageMargin: imageMargin,
              imagePos: parseInt(dialogData.propertyPosition, 10),
              imageName: imageName,
              roadLength: dialogData.roadLength
            };

            this.diagramArr[event.currentIndex] = updateDataRelatedToImage;
            this.surveyUploadDiaService.setImageUploadDiagram(this.diagramArr.slice(0));
        break;

        // Default is for cancel button
        default:
        break;
      }
  }

  /**
   * @function: diagramManipulation
   * @description: This function manipulates the survey data to display the content in diagram
   * @param: surveyData
   * @returns: void
  */
  diagramManipulation(surveyData: Record<string, any>): void {
    const nearestKMStone1 = parseInt(surveyData?.nearestStoneNo1, 10); // Nearest KM Stone1 number
    const nearestKMStone2 = parseInt(surveyData?.nearestStoneNo2, 10); // Nearest KM Stone2 number
    const stoneKM1PlotDistance = parseInt(surveyData?.distanceFromPlot1,10); // Nearest KM Stone1 distance
    const stoneKM2PlotDistance = parseInt(surveyData?.distanceFromPlot2, 10); // Nearest KM Stone2 distance
    const plotWidth = parseInt(surveyData?.plotWidth, 10);
    const plotDepth = parseInt(surveyData?.plotDepth, 10);

    const plotDistanceLess1000 = stoneKM2PlotDistance < 1000;
    const conditionAB = surveyData?.stonePosition1 === 1 && surveyData?.stonePosition2 === 2; // Stone1 : Left city, Stone2 : Right city
    const conditionAA = surveyData?.stonePosition1 === 1 && surveyData?.stonePosition2 === 1; // Stone1 : Left city, Stone2 : Left city
    const conditionBB = surveyData?.stonePosition1 === 2 && surveyData?.stonePosition2 === 2; // Stone1 : Right city, Stone2 : Right city
    const conditionBA = surveyData?.stonePosition1 === 2 && surveyData?.stonePosition2 === 1; // Stone1 : Right city, Stone2 : Left city
    const conditionStone1G2 = nearestKMStone1 > nearestKMStone2; // Stone1 Number > Stone2 Number

    // Plot Distance less than 1000
    if (plotDistanceLess1000) {

      if (conditionAB) {
        // New Logic

        this.KMStone1UIDistance = this.KMStonesUIDistance - 45 - stoneKM1PlotDistance / 2;
        this.KMStone2UIDistance = this.KMStonesUIDistance + 15 + (stoneKM2PlotDistance - plotWidth) / 2;

        this.diagramForm.get('KMStone1')?.patchValue(nearestKMStone1);
        if (conditionStone1G2) {

          this.diagramForm.patchValue({
            KMStone2: this.diagramForm.get('KMStone1')?.value - 1,
            plotChainageNumber: this.diagramForm.get('KMStone2')?.value,
            plotPlacementA: stoneKM2PlotDistance,
            plotPlacementB: this.diagramForm.get('plotPlacementA')?.value - plotWidth,
            plotSide: 'RHS'
          });

          this.chainageOrder = -1;
        }
        else {
          this.diagramForm.patchValue({
            KMStone2: this.diagramForm.get('KMStone1')?.value + 1,
            plotChainageNumber: this.diagramForm.get('KMStone1')?.value,
            plotPlacementA: stoneKM1PlotDistance,
            plotPlacementB: this.diagramForm.get('plotPlacementA')?.value + plotWidth,
            plotSide: 'LHS'
          });

          this.chainageOrder = 1;
        }
      }

      else if (conditionBA) {
        // New Logic

        this.KMStone1UIDistance = this.KMStonesUIDistance - 45 - (stoneKM2PlotDistance - plotWidth) / 2;
        this.KMStone2UIDistance = this.KMStonesUIDistance + 15 + stoneKM1PlotDistance / 2;

        if (conditionStone1G2) {
          this.diagramForm.patchValue({
            KMStone1: nearestKMStone1 - 1,
            KMStone2: this.diagramForm.get('KMStone1')?.value + 1,
            plotChainageNumber: this.diagramForm.get('KMStone1')?.value,
            plotPlacementA: stoneKM2PlotDistance - plotWidth,
            plotPlacementB: stoneKM2PlotDistance,
            plotSide: 'LHS'
          });

          this.chainageOrder = 1;
        }
        else {
          this.diagramForm.patchValue({
            KMStone1: nearestKMStone1 + 1,
            KMStone2: this.diagramForm.get('KMStone1')?.value - 1,
            plotChainageNumber: this.diagramForm.get('KMStone2')?.value,
            plotPlacementA: stoneKM1PlotDistance + plotWidth,
            plotPlacementB: stoneKM1PlotDistance,
            plotSide: 'RHS'
          });

          this.chainageOrder = -1;
        }

      }

      else if (conditionAA) {
        // New Logic

        this.KMStone1UIDistance = this.KMStonesUIDistance - 45 - stoneKM1PlotDistance / 2;
        this.KMStone2UIDistance = this.KMStonesUIDistance + 15 + (stoneKM2PlotDistance - plotWidth) / 2;

        this.diagramForm.get('KMStone1')?.patchValue(nearestKMStone1);

        if (conditionStone1G2) {
          this.diagramForm.patchValue({
            KMStone2: this.diagramForm.get('KMStone1')?.value + 1,
            plotChainageNumber: this.diagramForm.get('KMStone1')?.value,
            plotPlacementA: stoneKM1PlotDistance,
            plotPlacementB: this.diagramForm.get('plotPlacementA')?.value + plotWidth,
            plotSide: 'LHS'
          });

          this.chainageOrder = 1;
        }
        else {
          this.diagramForm.patchValue({
            KMStone2: this.diagramForm.get('KMStone1')?.value - 1,
            plotChainageNumber: this.diagramForm.get('KMStone2')?.value,
            plotPlacementA: stoneKM2PlotDistance,
            plotPlacementB: stoneKM2PlotDistance - plotWidth,
            plotSide: 'RHS'
          });

          this.chainageOrder = -1;
        }

      }

      else {
        // New Logic

        this.KMStone1UIDistance = this.KMStonesUIDistance - 45 - (stoneKM2PlotDistance - plotWidth) / 2;
        this.KMStone2UIDistance = this.KMStonesUIDistance + 15 + stoneKM1PlotDistance / 2;

        if (conditionStone1G2) {
          this.diagramForm.patchValue({
            KMStone1: nearestKMStone1 + 1,
            KMStone2: this.diagramForm.get('KMStone1')?.value - 1,
            plotChainageNumber: this.diagramForm.get('KMStone2')?.value,
            plotPlacementA: stoneKM1PlotDistance + plotWidth,
            plotPlacementB: stoneKM1PlotDistance,
            plotSide: 'RHS'
          });

          this.chainageOrder = -1;
        }
        else {
          this.diagramForm.patchValue({
            KMStone1: nearestKMStone1 - 1,
            KMStone2: this.diagramForm.get('KMStone1')?.value + 1,
            plotChainageNumber: this.diagramForm.get('KMStone1')?.value,
            plotPlacementA: stoneKM2PlotDistance - plotWidth,
            plotPlacementB: this.diagramForm.get('plotPlacementA')?.value + plotWidth,
            plotSide: 'LHS'
          });

          this.chainageOrder = 1;
        }

      }

    }

    // Plot Distance greater than 1000
    else {

      if (conditionAB) {
        // New Logic

        this.KMStone1UIDistance = this.KMStonesUIDistance - 45 - (stoneKM1PlotDistance % 1000) / 2;
        this.KMStone2UIDistance = this.KMStonesUIDistance + 15 + (stoneKM2PlotDistance - plotWidth) / 2;

        if (conditionStone1G2) {
          this.diagramForm.patchValue({
            KMStone1: nearestKMStone1 - Math.floor(stoneKM1PlotDistance / 1000),
            KMStone2: this.diagramForm.get('KMStone1')?.value - 1,
            plotChainageNumber: this.diagramForm.get('KMStone2')?.value,
            plotPlacementA: stoneKM2PlotDistance,
            plotPlacementB: this.diagramForm.get('plotPlacementA')?.value - plotWidth,
            plotSide: 'RHS'

          });

          this.chainageOrder = -1;
        }
        else {
          this.diagramForm.patchValue({
            KMStone1: nearestKMStone1 + Math.floor(stoneKM1PlotDistance / 1000),
            KMStone2: this.diagramForm.get('KMStone1')?.value + 1,
            plotChainageNumber: this.diagramForm.get('KMStone1')?.value,
            plotPlacementA: stoneKM1PlotDistance % 1000,
            plotPlacementB: this.diagramForm.get('plotPlacementA')?.value + plotWidth,
            plotSide: 'LHS'
          });

          this.chainageOrder = 1;
        }

      }

      else if (conditionBA) {
        // New Logic

        this.KMStone1UIDistance = this.KMStonesUIDistance - 45 - (stoneKM2PlotDistance - plotWidth) / 2;
        this.KMStone2UIDistance = this.KMStonesUIDistance + 15 + (stoneKM1PlotDistance % 1000) / 2;

        if (conditionStone1G2) {
          this.diagramForm.patchValue({
            KMStone1: nearestKMStone1 - Math.floor(stoneKM1PlotDistance / 1000) - 1,
            KMStone2: this.diagramForm.get('KMStone1')?.value + 1,
            plotChainageNumber: this.diagramForm.get('KMStone1')?.value,
            plotPlacementA: stoneKM2PlotDistance - plotWidth,
            plotPlacementB: stoneKM2PlotDistance,
            plotSide: 'LHS'
          });

          this.chainageOrder = 1;
        }
        else {
          this.diagramForm.patchValue({
            KMStone1: nearestKMStone1 + Math.floor(stoneKM1PlotDistance / 1000) + 1,
            KMStone2: this.diagramForm.get('KMStone1')?.value - 1,
            plotChainageNumber: this.diagramForm.get('KMStone2')?.value,
            plotPlacementA: stoneKM1PlotDistance % 1000 + plotWidth,
            plotPlacementB: stoneKM1PlotDistance % 1000,
            plotSide: 'RHS'
          });

          this.chainageOrder = -1;
        }

      }

      else if (conditionAA) {
        // New Logic

        this.KMStone1UIDistance = this.KMStonesUIDistance - 45 - (stoneKM1PlotDistance % 1000) / 2;
        this.KMStone2UIDistance = this.KMStonesUIDistance + 15 + (stoneKM2PlotDistance - plotWidth) / 2;

        if (conditionStone1G2) {
          this.diagramForm.patchValue({
            KMStone1: nearestKMStone1 + Math.floor(stoneKM1PlotDistance / 1000),
            KMStone2: this.diagramForm.get('KMStone1')?.value + 1,
            plotChainageNumber: this.diagramForm.get('KMStone1')?.value,
            plotPlacementA: stoneKM1PlotDistance % 1000,
            plotPlacementB: this.diagramForm.get('plotPlacementA')?.value + plotWidth,
            plotSide: 'LHS'
          });

          this.chainageOrder = 1;
        }
        else {
          this.diagramForm.patchValue({
            KMStone1: nearestKMStone1 - Math.floor(stoneKM1PlotDistance / 1000),
            KMStone2: this.diagramForm.get('KMStone1')?.value - 1,
            plotChainageNumber: this.diagramForm.get('KMStone2')?.value,
            plotPlacementA: stoneKM2PlotDistance,
            plotPlacementB: this.diagramForm.get('plotPlacementA')?.value - plotWidth,
            plotSide: 'RHS'
          });

          this.chainageOrder = -1;
        }

      }

      else {
        // New Logic

        this.KMStone1UIDistance = this.KMStonesUIDistance - 45 - (stoneKM2PlotDistance - plotWidth) / 2;
        this.KMStone2UIDistance = this.KMStonesUIDistance + 15 + (stoneKM1PlotDistance % 1000) / 2;

        if (conditionStone1G2) {
          this.diagramForm.patchValue({
            KMStone1: nearestKMStone1 + Math.floor(stoneKM1PlotDistance / 1000) + 1,
            KMStone2: this.diagramForm.get('KMStone1')?.value - 1,
            plotChainageNumber: this.diagramForm.get('KMStone1')?.value,
            plotPlacementA: stoneKM1PlotDistance % 1000 + plotWidth,
            plotPlacementB: stoneKM1PlotDistance % 1000,
            plotSide: 'RHS'
          });

          this.chainageOrder = -1;
        }
        else {
          this.diagramForm.patchValue({
            KMStone1: nearestKMStone1 - Math.floor(stoneKM1PlotDistance / 1000) - 1,
            KMStone2: this.diagramForm.get('KMStone1')?.value + 1,
            plotChainageNumber: this.diagramForm.get('KMStone1')?.value,
            plotPlacementA: stoneKM2PlotDistance - plotWidth,
            plotPlacementB: stoneKM2PlotDistance,
            plotSide: 'LHS'
          });

          this.chainageOrder = 1;
        }

      }
    }

    if (this.chainageOrder === -1) {
      this.topUIDistance = this.KMStone1UIDistance + 80;
    }
    else {
      this.topUIDistance = this.KMStone1UIDistance + 30;
    }

    for (const formKey in surveyData) {
      if (formKey) {
        // You can use the surveyDiagramData in the html to make changes in the survey diagram
        this.surveyDiagramData[formKey] = surveyData[formKey];
      }
    }
  }
}

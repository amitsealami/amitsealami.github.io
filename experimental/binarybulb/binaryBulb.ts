class Bulb {
    light: boolean;
    position: number;
    constructor(position: number) {
        this.position = position;
        this.light = false;
    }
}

const lightOn = "images/light_on.png";
const lightOff = "images/light_off.png";

let bulbs: Bulb[] = [];

function PrintValue() {
    let value = 0;
    let position = 0;
    var text = "";
    for (var i = bulbs.length - 1; i >= 0; i--) {
        position = bulbs[i].position;
        if (bulbs[i].light == true) {
            value += Math.pow(2, position);
            text += "1 * " + Math.pow(2, position);
        } else {
            text += "0 * " + Math.pow(2, position);
        }
        if (i > 0) {
            text += " + ";
        }
    }
    text += " = " + value;
    let resultNode = document.getElementById("result");
    resultNode.innerHTML = text;
}

function Trigger(position: number) {
    let bulb = bulbs[position];
    bulb.light = !bulb.light;
    let img = document.getElementById('bulb' + position);
    if (bulb.light) {
        img.setAttribute("src", lightOn);
    }
    else {
        img.setAttribute("src", lightOff);
    }
    PrintValue();
}

function InsertImages(numberOfBulbs: number) {
    let divId = document.getElementById('bulbs');
    for (let i = numberOfBulbs - 1; i >= 0; i--) {
        let img = document.createElement("img");
        img.src = lightOff;
        img.id = "bulb" + i;
        img.onclick = function () {
            Trigger(i);
        };

        bulbs.push(new Bulb(numberOfBulbs - i - 1));

        img.title = "position: " + i;
        divId.appendChild(img);
    }
}


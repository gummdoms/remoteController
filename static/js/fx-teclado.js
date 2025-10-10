const MODIFIERS_ROW = `
            <div class="row-teclado modifiers">
                <button class="btn btn-modifier" data-modifier="ctrl">Ctrl</button>
                <button class="btn btn-modifier" data-modifier="alt">Alt</button>
                <button class="btn btn-modifier" data-modifier="shift">Shift</button>
                <button class="btn btn-modifier" data-modifier="win">Win</button>
            </div>
`;

function teclado_principal() {
    return `<div class="row-teclado">
                <button class="btn btn-teclado" data-key="q">q</button>
                <button class="btn btn-teclado" data-key="w">w</button>
                <button class="btn btn-teclado" data-key="e">e</button>
                <button class="btn btn-teclado" data-key="r">r</button>
                <button class="btn btn-teclado" data-key="t">t</button>
                <button class="btn btn-teclado" data-key="y">y</button>
                <button class="btn btn-teclado" data-key="u">u</button>
                <button class="btn btn-teclado" data-key="i">i</button>
                <button class="btn btn-teclado" data-key="o">o</button>
                <button class="btn btn-teclado" data-key="p">p</button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-teclado" data-key="a">a</button>
                <button class="btn btn-teclado" data-key="s">s</button>
                <button class="btn btn-teclado" data-key="d">d</button>
                <button class="btn btn-teclado" data-key="f">f</button>
                <button class="btn btn-teclado" data-key="g">g</button>
                <button class="btn btn-teclado" data-key="h">h</button>
                <button class="btn btn-teclado" data-key="j">j</button>
                <button class="btn btn-teclado" data-key="k">k</button>
                <button class="btn btn-teclado" data-key="l">l</button>
                <button class="btn btn-teclado" data-key="ñ">ñ</button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-shift">
                    <i class="bi bi-arrow-up-circle"></i>
                </button>
                <button class=" btn btn-teclado" data-key="z">z</button>
                <button class="btn btn-teclado" data-key="x">x</button>
                <button class="btn btn-teclado" data-key="c">c</button>
                <button class="btn btn-teclado" data-key="v">v</button>
                <button class="btn btn-teclado" data-key="b">b</button>
                <button class="btn btn-teclado" data-key="n">n</button>
                <button class="btn btn-teclado" data-key="m">m</button>
                <button class="btn btn-teclado backspace" data-key="backspace" data-hold="true">
                    <i class="bi bi-backspace"></i>
                </button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-number">?123</button>
                <button class="btn btn-teclado" data-key="/">/</button>
                <button class="btn btn-teclado space" data-key="space" data-hold="true">space</button>
                <button class="btn btn-teclado" data-key=".">.</button>
                <button class="btn btn-teclado enter" data-key="enter" data-hold="true">
                    <i class="bi bi-arrow-return-left"></i>
                </button>
            </div>
            ${MODIFIERS_ROW}
            <div class="row-special">
            <button class="hidde-teclado">
                    <i class='bx bx-chevron-down'></i>
                </button>
            </div>`;
}
function teclado_mayus() {
    return `
    <div class="row-teclado">
                <button class="btn btn-teclado" data-key="Q">Q</button>
                <button class="btn btn-teclado" data-key="W">W</button>
                <button class="btn btn-teclado" data-key="E">E</button>
                <button class="btn btn-teclado" data-key="R">R</button>
                <button class="btn btn-teclado" data-key="T">T</button>
                <button class="btn btn-teclado" data-key="Y">Y</button>
                <button class="btn btn-teclado" data-key="U">U</button>
                <button class="btn btn-teclado" data-key="I">I</button>
                <button class="btn btn-teclado" data-key="O">O</button>
                <button class="btn btn-teclado" data-key="P">P</button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-teclado" data-key="A">A</button>
                <button class="btn btn-teclado" data-key="S">S</button>
                <button class="btn btn-teclado" data-key="D">D</button>
                <button class="btn btn-teclado" data-key="F">F</button>
                <button class="btn btn-teclado" data-key="G">G</button>
                <button class="btn btn-teclado" data-key="H">H</button>
                <button class="btn btn-teclado" data-key="J">J</button>
                <button class="btn btn-teclado" data-key="K">K</button>
                <button class="btn btn-teclado" data-key="L">L</button>
                <button class="btn btn-teclado" data-key="Ñ">Ñ</button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-shift active btn-unshift">
                    <i class="bi bi-arrow-up-circle"></i>
                </button>
                <button class=" btn btn-teclado" data-key="Z">Z</button>
                <button class="btn btn-teclado" data-key="X">X</button>
                <button class="btn btn-teclado" data-key="C">C</button>
                <button class="btn btn-teclado" data-key="V">V</button>
                <button class="btn btn-teclado" data-key="B">B</button>
                <button class="btn btn-teclado" data-key="N">N</button>
                <button class="btn btn-teclado" data-key="M">M</button>
                <button class="btn btn-teclado backspace" data-key="backspace" data-hold="true">
                    <i class="bi bi-backspace"></i>
                </button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-number">?123</button>
                <button class="btn btn-teclado" data-key="/">/</button>
                <button class="btn btn-teclado space" data-key="space" data-hold="true">space</button>
                <button class="btn btn-teclado" data-key=".">.</button>
                <button class="btn btn-teclado enter" data-key="enter" data-hold="true">
                    <i class="bi bi-arrow-return-left"></i>
                </button>
            </div>
            ${MODIFIERS_ROW}
            <div class="row-special">
            <button class="hidde-teclado">
                    <i class='bx bx-chevron-down'></i>
                </button>
            </div>`;
}
function teclado_principal_special() {
    return `
    <div class="row-teclado">
                <button class="btn btn-teclado" data-key="1">1</button>
                <button class="btn btn-teclado" data-key="2">2</button>
                <button class="btn btn-teclado" data-key="3">3</button>
                <button class="btn btn-teclado" data-key="4">4</button>
                <button class="btn btn-teclado" data-key="5">5</button>
                <button class="btn btn-teclado" data-key="6">6</button>
                <button class="btn btn-teclado" data-key="7">7</button>
                <button class="btn btn-teclado" data-key="8">8</button>
                <button class="btn btn-teclado" data-key="9">9</button>
                <button class="btn btn-teclado" data-key="0">0</button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-teclado" data-key="@">@</button>
                <button class="btn btn-teclado" data-key="#">#</button>
                <button class="btn btn-teclado" data-key="$">$</button>
                <button class="btn btn-teclado" data-key="_">_</button>
                <button class="btn btn-teclado" data-key="&">&</button>
                <button class="btn btn-teclado" data-key="-">-</button>
                <button class="btn btn-teclado" data-key="+">+</button>
                <button class="btn btn-teclado" data-key="(">(</button>
                <button class="btn btn-teclado" data-key=")">)</button>
                <button class="btn btn-teclado" data-key="/">/</button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-special">
                    =/&lt;
                </button>
                <button class=" btn btn-teclado" data-key="*">*</button>
                <button class="btn btn-teclado" data-key='"'>"</button>
                <button class="btn btn-teclado" data-key="'">'</button>
                <button class="btn btn-teclado" data-key=":">:</button>
                <button class="btn btn-teclado" data-key=";">;</button>
                <button class="btn btn-teclado" data-key="!">!</button>
                <button class="btn btn-teclado" data-key="?">?</button>
                <button class="btn btn-teclado backspace" data-key="backspace" data-hold="true">
                    <i class="bi bi-backspace"></i>
                </button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-abc">ABC</button>
                <button class="btn btn-teclado" data-key=",">,</button>
                <button class="btn btn-only-number"><span>1 2</span><span>3 4</span></button>
                <button class="btn btn-teclado space" data-key="space" data-hold="true"></button>
                <button class="btn btn-teclado" data-key=".">.</button>
                <button class="btn btn-teclado enter" data-key="enter" data-hold="true">
                    <i class="bi bi-arrow-return-left"></i>
                </button>
            </div>
            ${MODIFIERS_ROW}
            <div class="row-special">
            <button class="hidde-teclado">
                    <i class='bx bx-chevron-down'></i>
                </button>
            </div>`;
}
function teclado_other_special() {
    return `
            <div class="row-teclado">
                <button class="btn btn-teclado" data-key="&#96;">&#96;</button>
                <button class="btn btn-teclado" data-key="|">|</button>
                <button class="btn btn-teclado" data-key="^">^</button>
                <button class="btn btn-teclado" data-key="ª">ª</button>
                <button class="btn btn-teclado" data-key="º">º</button>
                <button class="btn btn-teclado" data-key="¬">¬</button>
                <button class="btn btn-teclado" data-key="Ç">Ç</button>
                <button class="btn btn-teclado" data-key="=">=</button>
                <button class="btn btn-teclado" data-key="{">{</button>
                <button class="btn btn-teclado" data-key="}">}</button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-teclado" data-key="&#92;">&#92;</button>
                <button class="btn btn-teclado" data-key="%">%</button>
                <button class="btn btn-teclado" data-key="[">[</button>
                <button class="btn btn-teclado" data-key="]">]</button>
                <button class="btn btn-teclado" data-key="&">&</button>
                <button class="btn btn-teclado" data-key="-">-</button>
                <button class="btn btn-teclado" data-key="+">+</button>
                <button class="btn btn-teclado" data-key="(">(</button>
                <button class="btn btn-teclado" data-key=")">)</button>
                <button class="btn btn-teclado" data-key="/">/</button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-number">?123</button>
                <button class="btn btn-special-microsoft">
                    <i class="bi bi-microsoft"></i>
                </button>
                <button class="btn btn-special-co2">
                    <i class="bi bi-controller"></i>
                </button>
                <button class="btn btn-teclado" data-key=";">;</button>
                <button class="btn btn-teclado" data-key="!">!</button>
                <button class="btn btn-teclado" data-key="?">?</button>
                <button class="btn btn-teclado backspace" data-key="backspace" data-hold="true">
                    <i class="bi bi-backspace"></i>
                </button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-abc">ABC</button>
                <button class="btn btn-only-number"><span>1 2</span><span>3 4</span></button>
                <button class="btn btn-teclado space" data-key="space" data-hold="true"></button>
                <button class="btn btn-teclado" data-key=".">.</button>
                <button class="btn btn-teclado enter" data-key="enter" data-hold="true">
                    <i class="bi bi-arrow-return-left"></i>
                </button>
            </div>
            ${MODIFIERS_ROW}
            <div class="row-special">
                <button class="hidde-teclado">
                    <i class='bx bx-chevron-down'></i>
                </button>
            </div>`;
}
function teclado_only_numeric() {
    return `
     <div class="teclado-numerico">
                <div class="content-top">
                    <div class="content-left">
                        <button class="btn btn-teclado" data-key="+">+</button>
                        <button class="btn btn-teclado" data-key="-">-</button>
                        <button class="btn btn-teclado" data-key="*">*</button>
                        <button class="btn btn-teclado" data-key="/">/</button>
                        <button class="btn btn-teclado" data-key="(">(</button>
                        <button class="btn btn-teclado" data-key=")">)</button>
                    </div>
                    <div class="content-center">
                        <div class="row-teclado">
                            <button class="btn btn-teclado" data-key="1">1</button>
                            <button class="btn btn-teclado" data-key="2">2</button>
                            <button class="btn btn-teclado" data-key="3">3</button>
                        </div>
                        <div class="row-teclado">
                            <button class="btn btn-teclado" data-key="4">4</button>
                            <button class="btn btn-teclado" data-key="5">5</button>
                            <button class="btn btn-teclado" data-key="6">6</button>
                        </div>
                        <div class="row-teclado">
                            <button class="btn btn-teclado" data-key="7">7</button>
                            <button class="btn btn-teclado" data-key="8">8</button>
                            <button class="btn btn-teclado" data-key="9">9</button>
                        </div>
                    </div>
                    <div class="content-right">
                        <button class="btn btn-teclado" data-key="%">%</button>
                        <button class="btn btn-teclado space" data-key="space" data-hold="true">
                            <i class='bx bx-space-bar'></i>
                        </button>
                        <button class="btn btn-teclado backspace" data-key="backspace" data-hold="true">
                            <i class="bi bi-backspace"></i>
                        </button>
                    </div>
                </div>
                <div class="content-bottom">
                    <button class="btn btn-abc">ABC</button>
                    <button class="btn btn-teclado" data-key=",">,</button>
                    <button class="btn btn-number">!?#</button>
                    <button class="btn btn-teclado btn-cero" data-key="0">0</button>
                    <button class="btn btn-teclado" data-key="=">=</button>
                    <button class="btn btn-teclado" data-key=".">.</button>
                    <button class="btn btn-teclado enter" data-key="enter" data-hold="true">
                        <i class="bi bi-arrow-return-left"></i>
                    </button>
                </div>

            </div>
            ${MODIFIERS_ROW}
            <div class="row-special">
                <button class="hidde-teclado">
                    <i class='bx bx-chevron-down'></i>
                </button>

            </div>
    `;
}

function teclado_microsoft() {
    let html = `
    <div class="teclado-microsoft">
        <div class="mic-left">
            <div class="row-teclado">
                <button class="btn btn-only-number"><span>1 2</span><span>3 4</span></button>
                <button class="btn btn-number">?123</button>
                <button class="btn btn-special">=/&lt;</button>
                <button class="btn btn-abc">ABC</button>
            </div>
        </div>
        <div class="mic-center">
            <div class="row-teclado">
                <!-- <button class="btn btn-teclado special-keyboard impr-pant" data-key="printscreen">Impr Pant</button> -->
                <button class="btn btn-teclado special-keyboard bloq-mayus" data-key="capslock">Bloq Mayus</button>
                <button class="btn btn-teclado special-keyboard bloq-despl" data-key="scrolllock">Bloq Despl</button>
                <button class="btn btn-teclado special-keyboard bloq-num" data-key="numlock">Bloq Num</button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-teclado special-keyboard" data-key="insert">Insert</button>
                <button class="btn btn-teclado special-keyboard" data-key="home">Home</button>
                <button class="btn btn-teclado special-keyboard" data-key="pageup">Re Pag</button>
            </div>
            <div class="row-teclado">
                <button class="btn btn-teclado special-keyboard" data-key="delete">Supr</button>
                <button class="btn btn-teclado special-keyboard" data-key="end">End</button>
                <button class="btn btn-teclado special-keyboard" data-key="pagedown">Av Pag</button>
            </div>
        </div>
        <div class="mic-right">
            <div class="row-teclado">
                <button class="btn btn-teclado special-keyboard" data-key="tab">Tab</button>
                <button class="btn btn-teclado special-keyboard" data-key="esc">Esc</button>
                <button class="btn btn-teclado backspace" data-key="backspace" data-hold="true">
                    <i class="bi bi-backspace"></i>
                </button>
                <button class="btn btn-teclado enter" data-key="enter" data-hold="true">
                    <i class="bi bi-arrow-return-left"></i>
                </button>
            </div>
        </div>
    </div>
    ${MODIFIERS_ROW}
    <div class="row-special">
        <button class="hidde-teclado">
            <i class='bx bx-chevron-down'></i>
        </button>
    </div>`;
    return html;
}
function teclado_cod_bo2() {
    //g_speed 190
    let html = `
    <div class="teclado-bo2">
            <div class="row-teclado first-line">
                <button class="btn btn-teclado-cod" data-key="god">god</button>
                <button class="btn btn-teclado-cod" data-key="noclip">noclip</button>
                <button class="btn btn-teclado-cod" title="Velocidad por defecto" data-key="g_speed 190">VD</button>
                <button class="btn btn-teclado-cod" title="Velocidad por 300" data-key="g_speed 300">V3</button>
                <button class="btn btn-teclado-cod" title="Velocidad por 500" data-key="g_speed 500">V5</button>
            </div>
            <div class="row-teclado second-line">
                <button class="btn btn-teclado" data-key="º">º</button>
                <button class="btn btn-teclado-cod" data-key="jump_height 39" title="Altura de salto por defecto">JD</button>
                <button class="btn btn-teclado-cod" data-key="jump_height 500" title="Altura de salto en 500">J5</button>
                <button class="btn btn-teclado-cod" data-key="map_restart">MR</button>
                <button class="btn btn-teclado-cod" data-key="Quit">X</button>
                <button class="btn btn-teclado-cod" data-key="sv_cheats 1">CA</button>
                <button class="btn btn-teclado-cod" data-key="sv_cheats 0">CI</button>
                <button class="btn btn-teclado backspace" data-key="backspace" data-hold="true">
                    <i class="bi bi-backspace"></i>
                </button>
            </div>
            <div class="row-teclado third-line">
                <button class="btn btn-abc">ABC</button>
                <button class="btn btn-teclado space" data-key="space" data-hold="true"></button>
                <button class="btn btn-teclado enter" data-key="enter" data-hold="true">
                    <i class="bi bi-arrow-return-left"></i>
                </button>
            </div>
            ${MODIFIERS_ROW}
            <div class="row-special">
            <button class="hidde-teclado">
                    <i class='bx bx-chevron-down'></i>
                </button>
            </div>
        </div>`;
    return html;
}



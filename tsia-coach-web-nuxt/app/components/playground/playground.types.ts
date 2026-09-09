import {type TablaModel, TablaModels} from "~/types/tabla-model.types.ts";
import {type Manipulative, Manipulatives} from "~/types/manipulative.types.ts";

export type  PlaygroundType={
    tablaModel:TablaModel
    manipulative:Manipulative
    
    
}
export type PlaygroundSlot = "barModelPlayground" | "arrayModelPlayground"

export type PlayGroundItem = {
    playGroundType: PlaygroundType
    label: string
    slot: PlaygroundSlot
}


export const PlayGroundItems = [
    {
        playGroundType: {
            tablaModel: TablaModels.BarModel,
            manipulative: Manipulatives.CuisenaireRods
        },
        label: "Bar Rod Playground",
        slot: "barModelPlayground" as const
    },
    {
        playGroundType: {
            tablaModel: TablaModels.ArrayModel,
            manipulative: Manipulatives.CuisenaireRods
        },
        label: "Array Rod Playground",
        slot: "arrayModelPlayground" as const
    }
] satisfies PlayGroundItem[]


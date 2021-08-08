import './App.css';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import {GetAuthorizationHeader} from './getAuth.js'

const LINE = ['板南線 - BL', '文湖線 - BR', '松山新店線 - G', '中和新蘆線 - O', '淡水信義線 - R', '環狀線 - Y'];

const App = () => {
    const [dropDown, setDropDown] = useState([]);

    const [lineChosen, setLineChosen] = useState('');
    const [stationChosen, setStationChosen] = useState('');
    const [mrtStationApi, setMrtStationApi] = useState([]);   //one array: name, position of the specific mrt station
    const [renderBikeStationInfo, setRenderBikeStationInfo] = useState([]); //arrays of bike station (stationId, address, name)
    const [availableBikeStation, setAvailableBikeStation] = useState([]); // arrays of available bike stations (id, addres, name, numrent, numrental)
    
    const [showPicture, setShowPicture] = useState(false); //for mrt pictures

    /* for station dropdown (after line is chosen)
    update everytime, after line chosen changes */
    useEffect(()=> {
        if(lineChosen){
            lineDecideStation();
        }
    }, [lineChosen]);

    /* after choosing station, request for mrt station (name, lat, lon) */
    useEffect(()=> {
        if(stationChosen){
            const response = async () => {
                let stationRequest = await apiStationRequest(lineChosen);
                setMrtStationApi(stationRequest[0]);
            }
            response();
            //console.log(renderStationInfo);
        }
    }, [stationChosen]);

    /* after choosing station, request for bike name and location api */
    useEffect(()=> {
        if(stationChosen) {
            const response = async () => {
                let dataByName = await apiBikeStationRequestName();

                const {lat, lon} = mrtStationApi;
                let dataByPosition = await apiBikeStationRequestLoc(lat, lon); //look for station by location
                var ids = new Set(dataByName.map(d => d.StationID)); 
                var wholeSearch = [...dataByName, ...dataByPosition.filter(station => !ids.has(station.StationID))]; //get unique arrays with unique id
                setRenderBikeStationInfo(wholeSearch); //for later apiBikeAvailability search
            }
            response();
        }
    }, [mrtStationApi]);

    /* after the name and location info, request for bike availability */
    useEffect(()=> {
        //console.log(renderBikeStationInfo);
        if(renderBikeStationInfo.length) {
                var arrayAvailable = [];
                var promises = renderBikeStationInfo.map(({StationID, StationAddress, StationName}) => {
                    const response = async () => {
                        var station = await apiBikeAvailability(StationID); //check if the station is available
                        if(station) {
                            station.id = StationID;
                            station.address = StationAddress;
                            station.name = StationName['Zh_tw'];
                            arrayAvailable = [...arrayAvailable, station];
                            setAvailableBikeStation(arrayAvailable);
                        }
                    }
                    response();
                });
        }

     }, [renderBikeStationInfo]);

    /* just checking for the available bike station */
     useEffect(() => {
         if(availableBikeStation) {
            console.log(availableBikeStation);
        }
     }, [availableBikeStation]);

    /* request specifically mrt line station for targeted station */
    const apiStationRequest = async (line) => {
        const {data} = await axios.get(`https://ptx.transportdata.tw/MOTC/v2/Rail/Metro/Station/TRTC?$filter=startswith(stationId%2C%20'${line}')&$top=200&$format=JSON`);
        const info = data.filter(station => station['StationName']['Zh_tw'].includes(stationChosen))
                .map((station) => {
                    var name = station['StationName']['Zh_tw'];
                    var lat = station.StationPosition.PositionLat;
                    var lon = station.StationPosition.PositionLon;
                    return {name, lat, lon}
                }                
        );       
        return info;
    }

    /* only request for every bike station that has '捷運' in the name *problem, i can actually want a specific station not just mrt */
    const apiBikeStationRequestName = async () => {

        const response = await axios.get(`https://ptx.transportdata.tw/MOTC/v2/Bike/Station/Taipei?$filter=contains(StationName%2FZh_tw%2C%20'%E6%8D%B7%E9%81%8B')&$top=200&$format=JSON`, {
        headers: GetAuthorizationHeader()
        });
        //console.log(response.data)        
        var renderStationResult = response.data.filter(station => station['StationName']['Zh_tw'].includes(stationChosen))
                                                .map((station) => {
                                                    var StationID = station['StationID'];
                                                    var StationAddress = station['StationAddress'];
                                                    var StationName = station['StationName'];
                                                    return {StationID, StationAddress, StationName}
                                                });
            
            //console.log(renderStationResult)
            return renderStationResult;
        };

    const apiBikeStationRequestLoc = async (lat, long) => {
        //console.log(lat, long);
        const response = await axios.get(`https://ptx.transportdata.tw/MOTC/v2/Bike/Station/Taipei?$top=50&$spatialFilter=nearby(${lat}%2C%20${long}%2C%20500)&$format=JSON`, {
            headers: GetAuthorizationHeader()
            });
            //console.log(response.data)

            const generalArray = response.data.map((station) => {
                                                    var StationID = station['StationID'];
                                                    var StationAddress = station['StationAddress'];
                                                    var StationName = station['StationName'];
                                                    return {StationID, StationAddress, StationName}
                                                });
            //console.log(generalArray)
            return generalArray;    
    } 

    /* bike availability at specific station
    use the name of the station and the geo location; if result = none, return ":("
    use parameters: stationID, serviceavailable === '1' */
    const apiBikeAvailability = async (id) => {
        if(id){
            var response = await axios.get(`https://ptx.transportdata.tw/MOTC/v2/Bike/Availability/Taipei?$filter=ServiceStatus%20eq%20'1'%20and%20StationID%20eq%20'${id}'&$top=30&$format=JSON`, {
                    headers: GetAuthorizationHeader()
            });
            
            const generalArray = response.data.filter(station => station)
                                              .map((station) => {
                                                var StationID = station['StationID'];
                                                var numRent = station['AvailableRentBikes'];
                                                var numReturn = station['AvailableReturnBikes'];
                                return {StationID, numRent, numReturn}
            });

        //console.log(generalArray[0])
        return generalArray[0];    
        }                    
    }

    /*after getting all the available bike stations, return each station info that will be on the page*/
    const displayResult = () => {        
        if(availableBikeStation) {
            return (
                <tbody>
                    {availableBikeStation.map(station => (
                        <tr key = {station.name}>
                        <td> {station.name} </td>
                        <td> {station.numRent} </td> 
                        <td> {station.numReturn} </td>
                        <td> {station.address['Zh_tw']? station.address['Zh_tw'] : station.address} </td>
                        </tr>    
                    ))}
                </tbody>
            )
        }
    }

    const lineDecideStation = () => {
        //console.log("lineDecideStation")
        let initialStations = [];

        const res = async () => {
            const line = lineChosen;
            //console.log("lineDecideStation " + line)

            if(line) {
                const {data} = await axios.get(`https://ptx.transportdata.tw/MOTC/v2/Rail/Metro/StationOfLine/TRTC?$filter=LineNo%20eq%20'${line}'&$top=30&$format=JSON`, {
                        headers: GetAuthorizationHeader()
                        });

                initialStations = data[0]['Stations'].map((station)=> {
                    return (
                        { value: station.StationName['Zh_tw'], label: station.StationName['Zh_tw']}
                    );   
                }); 
                setDropDown(initialStations);
            }            
        }
        return res();
    }
    
    /*dropdowns actions to search for the specific api*/
    const onChangeLine = (event) => {
        let dashIndex = event.value.indexOf('-');
        const lineAbbrev = event.value.slice(dashIndex+1).trim();        
        setLineChosen(lineAbbrev);
    }

    const onChangeStation = (event) => {
        setStationChosen(event.value);
    }

    /* drop down menus */
        //line
        const lineDropdown = (
            LINE.map((station) => {
                return (
                    { value: station, label: station}
                );
            })
        );

    /* mrt picture */
    const onShowPix = () => {
        setShowPicture(!showPicture);
    }

    let image = require('./map.png');

    return (
        <>
        <div className = "ui container">
            <div className="ui raised very padded text container segment">
                <h2 className="ui header"> 查詢 Ubike 捷運站 </h2>
                <div className = "topSelect">
                <Select
                        defaultValue={lineChosen}
                        onChange={onChangeLine}
                        options={lineDropdown}
                />
                </div>

                <div className = "bottomSelect">
                {lineChosen ?   
                    (      
                    <Select
                    defaultValue={stationChosen}
                    onChange={(onChangeStation)}
                    options={dropDown}
                    />)
                    : 
                    null
                } 
                </div>
                
                {renderBikeStationInfo.length ? 
                <table className = "ui celled padded table result">
                    <thead>
                        <tr>
                            <th className = "single line">站名 </th>
                            <th>可租數量 </th>
                            <th>待歸數量 </th>
                            <th>地址 </th> 
                        </tr>
                    </thead>
                    {displayResult()}

                </table> 
                :
                null
                }

                {stationChosen.length > 0 && renderBikeStationInfo.length === 0 ?
                    <div className = "result">
                        <p className= "sorry"> 暫時沒查詢到此uBike捷運站資訊。</p>
                        <p> 抱歉 :(  </p>
                    </div> 
                    :
                    null
                }


                <div>
                    <button className="ui blue button" onClick = {onShowPix}>捷運圖</button>
                    {showPicture ? <img className="ui centered large image" src={image.default}/> : null} 
                </div>
            </div>
        </div>
        </>
    )
};

export default App;